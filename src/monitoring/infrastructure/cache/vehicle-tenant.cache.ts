import { Injectable, OnModuleInit, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Subject } from 'rxjs';
import { Redis } from 'ioredis';
import { VehicleEntity } from '@vehicle/domain/entities/vehicle.entity';
import { DailyTicketEntity, TicketStatus } from '@daily-ticket/domain/entities/daily-ticket.entity';
import { TenantEntity } from '@tenant/domain/entities/tenant.entity';
import { RouteEntity } from '@route/domain/entities/route.entity';
import { DailyRoundEntity, RoundsStatus } from '../../../daily-ticket/domain/entities/daily-round.entity';
import { InfractionEntity, InfractionStatus } from '../../../infraction/domain/entities/infraction.entity';
import { ITraccarProvider } from '@shared/infrastructure/traccar/traccar-provider.interface';
import { getLocalDateString } from '@shared/utils/date.util';

export interface CachedVehicleState {
  vehicleId: string;
  tenantId: string;
  tenantName?: string;
  dailyTicketId: string | null;
  plate: string;
  driverName: string | null;
  driverId: string | null;
  routeId: string | null;
  routeName?: string;
  direction: 'IDA' | 'VUELTA' | null;
  lastPosition?: any;
  roundId?: string | null;
  roundStatus?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | null;
  hasPendingInfractions?: boolean;
}

@Injectable()
export class VehicleTenantCache implements OnModuleInit {
  private readonly logger = new Logger(VehicleTenantCache.name);
  
  // Stream de actualizaciones en caliente para componentes reactivos (WebSockets)
  public readonly cacheUpdates$ = new Subject<{ vehicleId: string; state: CachedVehicleState; previousDriverId?: string | null }>();
  
  // Caché rápida en RAM local únicamente para mapear tenantId -> tenantSlug
  private readonly tenantIdToSlug = new Map<string, string>();
  private readonly tenantSlugToId = new Map<string, string>();

  private preloadPromise: Promise<void> | null = null;
  private lastLoadDate: string | null = null;
  private midnightTimeout: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(VehicleEntity)
    private readonly vehicleRepository: Repository<VehicleEntity>,
    @InjectRepository(DailyTicketEntity)
    private readonly ticketRepository: Repository<DailyTicketEntity>,
    @InjectRepository(TenantEntity)
    private readonly tenantRepository: Repository<TenantEntity>,
    @InjectRepository(RouteEntity)
    private readonly routeRepository: Repository<RouteEntity>,
    @InjectRepository(DailyRoundEntity)
    private readonly roundRepository: Repository<DailyRoundEntity>,
    @InjectRepository(InfractionEntity)
    private readonly infractionRepository: Repository<InfractionEntity>,
    private readonly configService: ConfigService,
    @Inject('ITraccarProvider')
    private readonly traccarProvider: ITraccarProvider,
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
  ) {}

  async onModuleInit() {
    await this.preloadCache();
    this.scheduleMidnightReset();
  }

  /**
   * Precarga en Redis toda la información de vehículos y sus tickets diarios activos del día.
   */
  async preloadCache(): Promise<void> {
    if (this.preloadPromise) return this.preloadPromise;

    this.preloadPromise = (async () => {
      try {
        this.logger.log('[Cache Redis] Iniciando precarga de caché de vehículos y tickets diarios en Redis...');
        
        // Cargar mapas locales en RAM de Tenants para enrutamiento rápido
        const tenantsList = await this.tenantRepository.find();
        this.tenantIdToSlug.clear();
        this.tenantSlugToId.clear();
        const tenantMap = new Map<string, string>();
        
        for (const t of tenantsList) {
          this.tenantIdToSlug.set(t.id, t.subdomain);
          this.tenantSlugToId.set(t.subdomain, t.id);
          tenantMap.set(t.id, t.name);
        }

        // Recuperar posiciones GPS en caliente de los Hashes de Redis existentes para no perderlas tras reiniciar
        const savedPositions = new Map<number, any>();
        for (const t of tenantsList) {
          const tenantSlug = t.subdomain;
          const posMap = await this.redis.hgetall(`${tenantSlug}_cache_vehiculos`);
          for (const [traccarIdStr, posJson] of Object.entries(posMap)) {
            try {
              savedPositions.set(parseInt(traccarIdStr, 10), JSON.parse(posJson));
            } catch (err) {
              // Ignorar JSON malformado
            }
          }
        }

        // Limpiar cachés antiguas en Redis para los Tenants detectados
        for (const t of tenantsList) {
          const tenantSlug = t.subdomain;
          await this.redis.del(`${tenantSlug}_cache_vehiculos`);
          await this.redis.del(`${tenantSlug}_cache_tickets`);
        }
        await this.redis.del('gps:device-to-tenant');
        await this.redis.del('gps:vehicle-to-device');

        // Cargar mapas de rutas
        const routesList = await this.routeRepository.find();
        const routeMap = new Map<string, string>();
        for (const r of routesList) {
          routeMap.set(r.id, r.name);
        }

        // 1. Obtener todos los vehículos
        const vehicles = await this.vehicleRepository.find() as any[];
        
        // 2. Obtener los tickets activos del día actual de trabajo
        const todayStr = getLocalDateString();
        
        const activeTickets = await this.ticketRepository.find({
          where: {
            status: TicketStatus.ACTIVE,
            workDate: todayStr as any,
          },
          relations: ['driver', 'rounds'],
        });

        // Obtener infracciones pendientes de la base de datos para mapeo rápido
        const pendingInfractions = await this.infractionRepository.find({
          where: { status: InfractionStatus.PENDING }
        });
        const pendingInfractionTicketIds = new Set<string>();
        for (const inf of pendingInfractions) {
          pendingInfractionTicketIds.add(inf.dailyTicketId);
        }

        // Mapear los tickets activos por vehicleId
        const activeTicketsByVehicle = new Map<string, { 
          ticketId: string; 
          driverName: string; 
          driverId: string | null;
          routeId: string | null;
          direction: 'IDA' | 'VUELTA' | null;
          roundId: string | null;
          roundStatus: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | null;
          hasPendingInfractions: boolean;
        }>(); 
        for (const ticket of activeTickets) {
          let direction: 'IDA' | 'VUELTA' | null = 'IDA';
          let roundId: string | null = null;
          let roundStatus: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | null = null;

          if (ticket.rounds && ticket.rounds.length > 0) {
            const activeRound = ticket.rounds.find(r => r.status === RoundsStatus.IN_PROGRESS)
              || ticket.rounds.find(r => r.status === RoundsStatus.PENDING)
              || ticket.rounds[ticket.rounds.length - 1];
            
            if (activeRound) {
              direction = activeRound.direction as any;
              roundId = activeRound.id;
              roundStatus = activeRound.status as any;
            }
          }

          const hasPendingInfractions = pendingInfractionTicketIds.has(ticket.id);

          activeTicketsByVehicle.set(ticket.vehicleId, {
            ticketId: ticket.id,
            driverName: ticket.driver ? ticket.driver.name : 'No asignado',
            driverId: ticket.driverId || null,
            routeId: ticket.routeId || null,
            direction: direction,
            roundId: roundId,
            roundStatus: roundStatus,
            hasPendingInfractions: hasPendingInfractions,
          });
        }

        // 3. Autocuración de traccarId si falta localmente
        const needsTraccarApiFetch = vehicles.some(v => v.traccarDeviceId && !v.traccarId);
        const traccarDeviceMap = new Map<string, number>();

        if (needsTraccarApiFetch) {
          this.logger.log('[Cache Redis] Se detectaron vehículos sin traccarId localmente. Consultando API de Traccar para autocuración...');
          try {
            const traccarUrl = this.configService.get<string>('TRACCAR_URL') || 'http://localhost:8082';
            const traccarAuth = this.configService.get<string>('TRACCAR_AUTHORIZATION') || '';
            
            const response = await fetch(`${traccarUrl.replace(/\/$/, '')}/api/devices`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...(traccarAuth ? { 'Authorization': traccarAuth } : {}),
              },
            });

            if (response.ok) {
              const traccarDevices = (await response.json()) as any[];
              for (const device of traccarDevices) {
                if (device.uniqueId && device.id) {
                  traccarDeviceMap.set(device.uniqueId, device.id);
                }
              }
            }
          } catch (traccarError: any) {
            this.logger.error(`[Cache Redis] Error al consultar dispositivos auxiliares en Traccar: ${traccarError.message}`);
          }
        }

        // 4. Estructurar e hidratar Redis
        let loadedCount = 0;
        for (const vehicle of vehicles) {
          if (!vehicle.traccarDeviceId) continue;
          
          let traccarIdNum: number | undefined = vehicle.traccarId ?? undefined;
          
          if (traccarIdNum === undefined) {
            traccarIdNum = traccarDeviceMap.get(vehicle.traccarDeviceId);
          }

          if (traccarIdNum === undefined) {
            traccarIdNum = parseInt(vehicle.traccarDeviceId, 10);
            if (isNaN(traccarIdNum)) {
              continue;
            }
          }

          const tenantSlug = this.tenantIdToSlug.get(vehicle.tenantId);
          if (!tenantSlug) continue;

          const ticketData = activeTicketsByVehicle.get(vehicle.id) || null;

          const state: CachedVehicleState = {
            vehicleId: vehicle.id,
            tenantId: vehicle.tenantId,
            tenantName: tenantMap.get(vehicle.tenantId) || 'No especificado',
            dailyTicketId: ticketData ? ticketData.ticketId : null,
            plate: vehicle.plate,
            driverName: ticketData ? ticketData.driverName : 'No asignado',
            driverId: ticketData ? ticketData.driverId : null,
            routeId: ticketData ? ticketData.routeId : null,
            routeName: ticketData && ticketData.routeId ? (routeMap.get(ticketData.routeId) || 'Sin Ruta') : 'Sin Ruta',
            direction: ticketData ? ticketData.direction : null,
            roundId: ticketData ? ticketData.roundId : null,
            roundStatus: ticketData ? ticketData.roundStatus : null,
            hasPendingInfractions: ticketData ? ticketData.hasPendingInfractions : false,
          };

          // Inyectar en los Hashes de Redis correspondientes
          await this.redis.hset('gps:device-to-tenant', traccarIdNum.toString(), tenantSlug);
          await this.redis.hset('gps:vehicle-to-device', vehicle.id, traccarIdNum.toString());
          await this.redis.hset(`${tenantSlug}_cache_tickets`, traccarIdNum.toString(), JSON.stringify(state));

          const savedPos = savedPositions.get(traccarIdNum);
          if (savedPos) {
            await this.redis.hset(`${tenantSlug}_cache_vehiculos`, traccarIdNum.toString(), JSON.stringify(savedPos));
          }

          loadedCount++;
        }

        this.lastLoadDate = todayStr;
        this.logger.log(`[Cache Redis] Hidratación completada para el día ${todayStr}. ${loadedCount} vehículos registrados.`);
      } catch (error: any) {
        this.logger.error(`[Cache Redis] Error crítico al inicializar la caché en Redis: ${error.message}`, error.stack);
      }
    })();

    return this.preloadPromise;
  }

  /**
   * Obtiene el estado en memoria de un vehículo a partir de su ID de Traccar
   */
  async getVehicleState(traccarDeviceId: number | string): Promise<CachedVehicleState | null> {
    await this.checkAndResetCacheIfNewDay();
    const idStr = traccarDeviceId.toString();
    
    // 1. Obtener el enrutamiento del Tenant
    const tenantSlug = await this.redis.hget('gps:device-to-tenant', idStr);
    if (!tenantSlug) return null;

    // 2. Obtener el estado del ticket y la última posición de forma asíncrona
    const [stateJson, posJson] = await Promise.all([
      this.redis.hget(`${tenantSlug}_cache_tickets`, idStr),
      this.redis.hget(`${tenantSlug}_cache_vehiculos`, idStr),
    ]);

    if (!stateJson) return null;

    try {
      const state: CachedVehicleState = JSON.parse(stateJson);
      if (posJson) {
        state.lastPosition = JSON.parse(posJson);
      }
      return state;
    } catch (err) {
      return null;
    }
  }

  /**
   * Actualiza la última posición conocida de un vehículo en la caché de Redis
   */
  async updateLastPosition(traccarDeviceId: number | string, position: any): Promise<void> {
    await this.checkAndResetCacheIfNewDay();
    const idStr = traccarDeviceId.toString();

    const tenantSlug = await this.redis.hget('gps:device-to-tenant', idStr);
    if (!tenantSlug) return;

    await this.redis.hset(`${tenantSlug}_cache_vehiculos`, idStr, JSON.stringify(position));
  }

  /**
   * Obtiene la última posición conocida enriquecida de toda la flota de un tenant específico
   */
  async getLatestPositionsByTenant(tenantId: string): Promise<any[]> {
    await this.checkAndResetCacheIfNewDay();
    
    const tenantSlug = this.tenantIdToSlug.get(tenantId);
    if (!tenantSlug) return [];

    // Obtener en lote ambos mapas de Redis
    const [ticketsMap, positionsMap] = await Promise.all([
      this.redis.hgetall(`${tenantSlug}_cache_tickets`),
      this.redis.hgetall(`${tenantSlug}_cache_vehiculos`),
    ]);

    const positions: any[] = [];
    for (const [traccarIdStr, stateJson] of Object.entries(ticketsMap)) {
      try {
        const state: CachedVehicleState = JSON.parse(stateJson);
        const posJson = positionsMap[traccarIdStr];
        
        if (posJson) {
          const lastPosition = JSON.parse(posJson);
          positions.push({
            ...lastPosition,
            vehicleId: state.vehicleId,
            plate: state.plate,
            driverName: state.driverName,
            driverId: state.driverId,
            routeId: state.routeId,
            direction: state.direction,
            dailyTicketId: state.dailyTicketId,
            hasActiveTicket: !!state.dailyTicketId,
            roundId: state.roundId,
            roundStatus: state.roundStatus,
            hasPendingInfractions: state.hasPendingInfractions,
          });
        }
      } catch (err) {
        // Ignorar JSON corrupto
      }
    }
    return positions;
  }

  /**
   * Obtiene la última posición conocida enriquecida del vehículo asignado a un conductor específico
   */
  async getLatestPositionByDriver(driverId: string): Promise<any | null> {
    await this.checkAndResetCacheIfNewDay();

    // Recorrer los tenants a través de los mapas en RAM
    for (const tenantSlug of this.tenantIdToSlug.values()) {
      const ticketsMap = await this.redis.hgetall(`${tenantSlug}_cache_tickets`);
      
      for (const [traccarIdStr, stateJson] of Object.entries(ticketsMap)) {
        try {
          const state: CachedVehicleState = JSON.parse(stateJson);
          
          if (state.driverId === driverId) {
            const posJson = await this.redis.hget(`${tenantSlug}_cache_vehiculos`, traccarIdStr);
            if (posJson) {
              const lastPosition = JSON.parse(posJson);
              return {
                ...lastPosition,
                vehicleId: state.vehicleId,
                plate: state.plate,
                driverName: state.driverName,
                driverId: state.driverId,
                routeId: state.routeId,
                direction: state.direction,
                dailyTicketId: state.dailyTicketId,
                hasActiveTicket: !!state.dailyTicketId,
                roundId: state.roundId,
                roundStatus: state.roundStatus,
                hasPendingInfractions: state.hasPendingInfractions,
              };
            }
            return null;
          }
        } catch (err) {
          // Ignorar
        }
      }
    }
    return null;
  }

  /**
   * Registra o actualiza en caliente el ticket diario de un vehículo en la caché de Redis
   */
  async setDailyTicketId(vehicleId: string, dailyTicketId: string | null): Promise<void> {
    await this.checkAndResetCacheIfNewDay();
    const traccarIdStr = await this.redis.hget('gps:vehicle-to-device', vehicleId);
    if (!traccarIdStr) {
      this.logger.warn(`Intento de actualizar ticket para vehículo ${vehicleId} pero no existe traducción en Redis.`);
      return;
    }

    const tenantSlug = await this.redis.hget('gps:device-to-tenant', traccarIdStr);
    if (!tenantSlug) {
      this.logger.warn(`Intento de actualizar ticket para vehículo ${vehicleId} pero no tiene tenant mapeado.`);
      return;
    }

    const stateJson = await this.redis.hget(`${tenantSlug}_cache_tickets`, traccarIdStr);
    if (!stateJson) {
      this.logger.warn(`Intento de actualizar ticket para vehículo ${vehicleId} pero no hay estado inicial en Redis.`);
      return;
    }

    try {
      const currentState: CachedVehicleState = JSON.parse(stateJson);
      const previousDriverId = currentState.driverId;

      currentState.dailyTicketId = dailyTicketId;
      
      let driverName = 'No asignado';
      let driverId: string | null = null;
      let routeId: string | null = null;
      let routeName = 'Sin Ruta';
      let direction: 'IDA' | 'VUELTA' | null = null;
      let roundId: string | null = null;
      let roundStatus: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | null = null;
      let hasPendingInfractions = false;

      if (dailyTicketId) {
        const ticket = await this.ticketRepository.findOne({
          where: { id: dailyTicketId },
          relations: ['driver', 'rounds'],
        });
        if (ticket) {
          driverName = ticket.driver ? ticket.driver.name : 'No asignado';
          driverId = ticket.driverId || null;
          routeId = ticket.routeId || null;
          
          if (ticket.routeId) {
            const routeObj = await this.routeRepository.findOne({ where: { id: ticket.routeId } });
            routeName = routeObj ? routeObj.name : 'Sin Ruta';
          }
          
          if (ticket.rounds && ticket.rounds.length > 0) {
            const activeRound = ticket.rounds.find(r => r.status === RoundsStatus.IN_PROGRESS)
              || ticket.rounds.find(r => r.status === RoundsStatus.PENDING)
              || ticket.rounds[ticket.rounds.length - 1];
            if (activeRound) {
              direction = activeRound.direction as any;
              roundId = activeRound.id;
              roundStatus = activeRound.status as any;
            }
          } else {
            direction = 'IDA';
          }

          const pendingCount = await this.infractionRepository.count({
            where: { dailyTicketId, status: InfractionStatus.PENDING }
          });
          hasPendingInfractions = pendingCount > 0;
        }
      }
      
      currentState.driverName = driverName;
      currentState.driverId = driverId;
      currentState.routeId = routeId;
      currentState.routeName = routeName;
      currentState.direction = direction;
      currentState.roundId = roundId;
      currentState.roundStatus = roundStatus;
      currentState.hasPendingInfractions = hasPendingInfractions;

      // Escribir en caliente en Redis
      await this.redis.hset(`${tenantSlug}_cache_tickets`, traccarIdStr, JSON.stringify(currentState));
      this.logger.log(`[Cache Redis] Asignado ticket ${dailyTicketId} a vehículo ${vehicleId} en Redis.`);

      // Notificar reactivamente a los suscriptores (WebSockets)
      this.cacheUpdates$.next({ vehicleId, state: currentState, previousDriverId });
    } catch (error: any) {
      this.logger.error(`Error al actualizar el ticket diario en caliente en Redis: ${error.message}`);
    }
  }

  /**
   * Agrega o actualiza un vehículo completo en la caché de Redis
   */
  async setVehicleState(traccarDeviceId: number, state: CachedVehicleState): Promise<void> {
    await this.checkAndResetCacheIfNewDay();
    const traccarIdStr = traccarDeviceId.toString();
    
    const tenantSlug = this.tenantIdToSlug.get(state.tenantId);
    if (!tenantSlug) return;

    // Guardar enrutamiento global
    await this.redis.hset('gps:device-to-tenant', traccarIdStr, tenantSlug);
    await this.redis.hset('gps:vehicle-to-device', state.vehicleId, traccarIdStr);

    // Separar posición de estado
    const { lastPosition, ...ticketState } = state;
    await this.redis.hset(`${tenantSlug}_cache_tickets`, traccarIdStr, JSON.stringify(ticketState));
    if (lastPosition) {
      await this.redis.hset(`${tenantSlug}_cache_vehiculos`, traccarIdStr, JSON.stringify(lastPosition));
    }
  }

  /**
   * Elimina un vehículo de la caché de Redis
   */
  async removeVehicleState(traccarDeviceId: number, vehicleId?: string): Promise<void> {
    const traccarIdStr = traccarDeviceId.toString();
    const tenantSlug = await this.redis.hget('gps:device-to-tenant', traccarIdStr);
    
    if (tenantSlug) {
      await this.redis.hdel(`${tenantSlug}_cache_vehiculos`, traccarIdStr);
      await this.redis.hdel(`${tenantSlug}_cache_tickets`, traccarIdStr);
    }
    await this.redis.hdel('gps:device-to-tenant', traccarIdStr);
    if (vehicleId) {
      await this.redis.hdel('gps:vehicle-to-device', vehicleId);
    }
  }

  /**
   * Valida si el día de hoy difiere del día en que se cargó la caché.
   * Si es así, realiza un auto-reinicio de manera asíncrona.
   */
  private async checkAndResetCacheIfNewDay(): Promise<void> {
    const todayStr = getLocalDateString();

    if (this.lastLoadDate && this.lastLoadDate !== todayStr) {
      this.logger.log(`[Cache Redis] Cambio de día detectado (Antes: ${this.lastLoadDate}, Ahora: ${todayStr}). Reiniciando...`);
      await this.resetCache();
    }
  }

  /**
   * Programa la tarea de medianoche (00:05) de forma autónoma.
   */
  private scheduleMidnightReset() {
    if (this.midnightTimeout) {
      clearTimeout(this.midnightTimeout);
    }

    const now = new Date();
    const midnight = new Date();
    
    midnight.setHours(24, 5, 0, 0);
    const msUntilMidnight = midnight.getTime() - now.getTime();

    this.logger.log(`[Cache Redis] Programando reinicio diario automático en ${Math.round(msUntilMidnight / 1000 / 60)} minutos (a las 00:05).`);

    this.midnightTimeout = setTimeout(async () => {
      this.logger.log('[Cache Redis] Cron de medianoche activado. Reiniciando caché...');
      try {
        await this.resetCache();
      } catch (error: any) {
        this.logger.error(`[Cache Redis] Error en el reinicio de medianoche: ${error.message}`);
      }
      this.scheduleMidnightReset();
    }, msUntilMidnight);
  }

  /**
   * Fuerza el reinicio completo de la caché en Redis e hidratación desde PostgreSQL.
   */
  async resetCache(options?: { unlinkDevices?: boolean }): Promise<void> {
    const unlink = options?.unlinkDevices ?? false;
    this.logger.log(`[Cache Redis] resetCache invocado. ¿Desafiliar de Traccar?: ${unlink}`);

    if (unlink) {
      try {
        // Consultar los tenants activos para desafiliar
        const tenantsList = await this.tenantRepository.find();
        
        for (const t of tenantsList) {
          const tenantSlug = t.subdomain;
          const ticketsMap = await this.redis.hgetall(`${tenantSlug}_cache_tickets`);
          
          const activeVehicles = Object.entries(ticketsMap)
            .map(([traccarIdStr, stateJson]) => {
              try {
                const state = JSON.parse(stateJson);
                if (state.dailyTicketId !== null) {
                  return { traccarId: parseInt(traccarIdStr, 10), plate: state.plate };
                }
              } catch (e) {}
              return null;
            })
            .filter(v => v !== null) as any[];

          if (activeVehicles.length > 0) {
            this.logger.log(`[Cache Redis] Desafiliando ${activeVehicles.length} vehículo(s) del tenant ${tenantSlug} en Traccar...`);
            const updatePromises = activeVehicles.map(async (v) => {
              const vehicleObj = await this.vehicleRepository.findOne({ where: { traccarId: v.traccarId } });
              if (vehicleObj && vehicleObj.traccarDeviceId) {
                await this.traccarProvider.updateDevice(v.traccarId, {
                  name: vehicleObj.plate,
                  uniqueId: vehicleObj.traccarDeviceId,
                  groupId: 0
                });
              }
            });
            await Promise.allSettled(updatePromises);
          }
        }
      } catch (err: any) {
        this.logger.error(`[Cache Redis] Error al desafiliar en lote de Traccar: ${err.message}`);
      }
    }

    // Anular infracciones TENTATIVE residuales de días anteriores de forma masiva
    try {
      this.logger.log(`[Cache Redis] Anulando infracciones tentativas de días anteriores...`);
      const updateResult = await this.infractionRepository.update(
        { status: InfractionStatus.TENTATIVE },
        { 
          status: InfractionStatus.ANNULLED,
          cancellationReason: 'Anulada automáticamente en el reinicio de jornada del sistema (no convalidada por satélite).'
        }
      );
      this.logger.log(`[Cache Redis] Infracciones tentativas residuales anuladas: ${updateResult.affected ?? 0}`);
    } catch (err: any) {
      this.logger.error(`[Cache Redis] Error al anular infracciones tentativas de días anteriores: ${err.message}`);
    }

    this.preloadPromise = null;
    await this.preloadCache();
  }

  /**
   * Obtiene una previsualización de diagnóstico de la caché en Redis
   */
  async getCacheStatus(): Promise<any[]> {
    await this.checkAndResetCacheIfNewDay();
    const list: any[] = [];

    for (const tenantSlug of this.tenantIdToSlug.values()) {
      const [ticketsMap, positionsMap] = await Promise.all([
        this.redis.hgetall(`${tenantSlug}_cache_tickets`),
        this.redis.hgetall(`${tenantSlug}_cache_vehiculos`),
      ]);

      for (const [traccarIdStr, stateJson] of Object.entries(ticketsMap)) {
        try {
          const state: CachedVehicleState = JSON.parse(stateJson);
          const posJson = positionsMap[traccarIdStr];
          
          if (posJson) {
            state.lastPosition = JSON.parse(posJson);
          }

          list.push({
            traccarDeviceId: parseInt(traccarIdStr, 10),
            ...state,
            hasActiveTicket: !!state.dailyTicketId,
          });
        } catch (e) {}
      }
    }
    return list.sort((a, b) => a.plate.localeCompare(b.plate));
  }
}
