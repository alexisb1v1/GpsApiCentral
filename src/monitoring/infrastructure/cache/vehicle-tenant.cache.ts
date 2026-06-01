import { Injectable, OnModuleInit, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Subject } from 'rxjs';
import { VehicleEntity } from '@vehicle/domain/entities/vehicle.entity';
import { DailyTicketEntity, TicketStatus } from '@daily-ticket/domain/entities/daily-ticket.entity';
import { ITraccarProvider } from '@shared/infrastructure/traccar/traccar-provider.interface';

export interface CachedVehicleState {
  vehicleId: string;
  tenantId: string;
  dailyTicketId: string | null; // UUID del ticket si pagó hoy, o null si no
  plate: string;
  driverName: string | null;
  driverId: string | null; // ID del conductor
  routeId: string | null; // ID de la ruta asignada
  direction: 'IDA' | 'VUELTA' | null; // Dirección activa de la ruta
  lastPosition?: any; // Última posición conocida reportada por Traccar
}

@Injectable()
export class VehicleTenantCache implements OnModuleInit {
  private readonly logger = new Logger(VehicleTenantCache.name);
  
  // Stream de actualizaciones en caliente para componentes reactivos (como WebSockets)
  public readonly cacheUpdates$ = new Subject<{ vehicleId: string; state: CachedVehicleState }>();
  
  // Mapa en memoria: traccarDeviceId (número) -> CachedVehicleState
  private readonly cache = new Map<number, CachedVehicleState>();
  
  // Mapa inverso para actualizaciones rápidas por vehicleId (string) -> traccarDeviceId (number)
  private readonly vehicleIdToTraccarId = new Map<string, number>();

  private preloadPromise: Promise<void> | null = null;
  private lastLoadDate: string | null = null;
  private midnightTimeout: NodeJS.Timeout | null = null;


  constructor(
    @InjectRepository(VehicleEntity)
    private readonly vehicleRepository: Repository<VehicleEntity>,
    @InjectRepository(DailyTicketEntity)
    private readonly ticketRepository: Repository<DailyTicketEntity>,
    private readonly configService: ConfigService,
    @Inject('ITraccarProvider')
    private readonly traccarProvider: ITraccarProvider,
  ) {}

  async onModuleInit() {
    await this.preloadCache();
    this.scheduleMidnightReset();
  }

  /**
   * Precarga en memoria toda la información de vehículos y sus tickets diarios activos del día.
   */
  async preloadCache(): Promise<void> {
    if (this.preloadPromise) return this.preloadPromise;

    this.preloadPromise = (async () => {
      try {
        this.logger.log('Iniciando precarga de caché de vehículos y tickets diarios...');
        this.cache.clear();
        this.vehicleIdToTraccarId.clear();

        // 1. Obtener todos los vehículos con traccarDeviceId configurado
        const vehicles = await this.vehicleRepository.find() as any[];
        
        // 2. Obtener los tickets activos del día actual de trabajo en hora de Pucallpa/Lima (America/Lima)
        const formatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Lima',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        const todayStr = formatter.format(new Date());
        
        const activeTickets = await this.ticketRepository.find({
          where: {
            status: TicketStatus.ACTIVE,
            workDate: todayStr as any,
          },
          relations: ['driver', 'rounds'],
        });

        // Mapear los tickets activos por vehicleId para búsqueda rápida en memoria
        const activeTicketsByVehicle = new Map<string, { 
          ticketId: string; 
          driverName: string; 
          driverId: string | null;
          routeId: string | null;
          direction: 'IDA' | 'VUELTA' | null;
        }>(); 
        for (const ticket of activeTickets) {
          let direction: 'IDA' | 'VUELTA' | null = 'IDA';
          if (ticket.rounds && ticket.rounds.length > 0) {
            const activeRound = ticket.rounds.find(r => r.status === 'IN_PROGRESS') || ticket.rounds[ticket.rounds.length - 1];
            direction = activeRound ? (activeRound.direction as any) : 'IDA';
          }
          activeTicketsByVehicle.set(ticket.vehicleId, {
            ticketId: ticket.id,
            driverName: ticket.driver ? ticket.driver.name : 'No asignado',
            driverId: ticket.driverId || null,
            routeId: ticket.routeId || null,
            direction: direction,
          });
        }

        // 3. Autocuración dinámica: Consultar a Traccar solo si se detectan vehículos activos sin traccarId local guardado
        const needsTraccarApiFetch = vehicles.some(v => v.traccarDeviceId && !v.traccarId);
        const traccarDeviceMap = new Map<string, number>();

        if (needsTraccarApiFetch) {
          this.logger.log('Se detectaron vehículos sin traccarId localmente en la base de datos. Consultando API de Traccar para autocuración en memoria...');
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
              this.logger.log(`Mapeo de dispositivos Traccar cargado de forma auxiliar. ${traccarDeviceMap.size} dispositivos encontrados.`);
            } else {
              this.logger.warn(`No se pudo obtener el mapeo dinámico de Traccar. Código de estado: ${response.status}`);
            }
          } catch (traccarError: any) {
            this.logger.error(`Error al consultar dispositivos auxiliares en Traccar: ${traccarError.message}`);
          }
        }

        // 4. Estructurar y cargar la caché en memoria
        let loadedCount = 0;
        for (const vehicle of vehicles) {
          if (!vehicle.traccarDeviceId) continue;
          
          let traccarIdNum: number | undefined = vehicle.traccarId ?? undefined;
          
          if (traccarIdNum === undefined) {
            // Si no está localmente, intentar obtenerlo del mapeo dinámico auxiliar de Traccar
            traccarIdNum = traccarDeviceMap.get(vehicle.traccarDeviceId);
          }

          if (traccarIdNum === undefined) {
            // Fallback final: intentar parsear como número directamente si nada más funcionó
            traccarIdNum = parseInt(vehicle.traccarDeviceId, 10);
            if (isNaN(traccarIdNum)) {
              this.logger.warn(`Vehículo "${vehicle.plate}" tiene un traccarDeviceId no numérico y no figura en Traccar: "${vehicle.traccarDeviceId}"`);
              continue;
            }
          }

          const ticketData = activeTicketsByVehicle.get(vehicle.id) || null;

          const state: CachedVehicleState = {
            vehicleId: vehicle.id,
            tenantId: vehicle.tenantId,
            dailyTicketId: ticketData ? ticketData.ticketId : null,
            plate: vehicle.plate,
            driverName: ticketData ? ticketData.driverName : 'No asignado',
            driverId: ticketData ? ticketData.driverId : null,
            routeId: ticketData ? ticketData.routeId : null,
            direction: ticketData ? ticketData.direction : null,
          };

          this.cache.set(traccarIdNum, state);
          this.vehicleIdToTraccarId.set(vehicle.id, traccarIdNum);
          loadedCount++;
        }

        this.lastLoadDate = todayStr;
        this.logger.log(`Caché en memoria inicializada exitosamente para el día ${todayStr}. ${loadedCount} vehículos cargados.`);
      } catch (error: any) {
        this.logger.error(`Error crítico al inicializar la caché de monitoreo: ${error.message}`, error.stack);
      }
    })();

    return this.preloadPromise;
  }

  /**
   * Obtiene el estado en memoria de un vehículo a partir de su ID de Traccar
   */
  getVehicleState(traccarDeviceId: number | string): CachedVehicleState | null {
    this.checkAndResetCacheIfNewDay().catch(err => 
      this.logger.error(`[Cache] Error al verificar auto-reinicio perezoso: ${err.message}`)
    );
    const id = typeof traccarDeviceId === 'string' ? parseInt(traccarDeviceId, 10) : traccarDeviceId;
    if (isNaN(id)) return null;
    return this.cache.get(id) || null;
  }

  /**
   * Actualiza la última posición conocida de un vehículo en la caché de memoria
   */
  updateLastPosition(traccarDeviceId: number | string, position: any): void {
    this.checkAndResetCacheIfNewDay().catch(err => 
      this.logger.error(`[Cache] Error al verificar auto-reinicio perezoso: ${err.message}`)
    );
    const id = typeof traccarDeviceId === 'string' ? parseInt(traccarDeviceId, 10) : traccarDeviceId;
    if (isNaN(id)) return;
    const state = this.cache.get(id);
    if (state) {
      state.lastPosition = position;
      this.cache.set(id, state);
    }
  }

  /**
   * Obtiene la última posición conocida enriquecida de toda la flota de un tenant específico
   */
  getLatestPositionsByTenant(tenantId: string): any[] {
    this.checkAndResetCacheIfNewDay().catch(err => 
      this.logger.error(`[Cache] Error al verificar auto-reinicio perezoso: ${err.message}`)
    );
    const positions: any[] = [];
    for (const [_, state] of this.cache.entries()) {
      if (state.tenantId === tenantId && state.lastPosition) {
        positions.push({
          ...state.lastPosition,
          vehicleId: state.vehicleId,
          plate: state.plate,
          driverName: state.driverName,
          driverId: state.driverId,
          routeId: state.routeId,
          direction: state.direction,
          dailyTicketId: state.dailyTicketId,
          hasActiveTicket: !!state.dailyTicketId,
        });
      }
    }
    return positions;
  }

  /**
   * Obtiene la última posición conocida enriquecida del vehículo asignado a un conductor específico
   */
  getLatestPositionByDriver(driverId: string): any | null {
    this.checkAndResetCacheIfNewDay().catch(err => 
      this.logger.error(`[Cache] Error al verificar auto-reinicio perezoso: ${err.message}`)
    );
    for (const [_, state] of this.cache.entries()) {
      if (state.driverId === driverId && state.lastPosition) {
        return {
          ...state.lastPosition,
          vehicleId: state.vehicleId,
          plate: state.plate,
          driverName: state.driverName,
          driverId: state.driverId,
          routeId: state.routeId,
          direction: state.direction,
          dailyTicketId: state.dailyTicketId,
          hasActiveTicket: !!state.dailyTicketId,
        };
      }
    }
    return null;
  }


  /**
   * Registra o actualiza en caliente el ticket diario de un vehículo en la caché
   */
  async setDailyTicketId(vehicleId: string, dailyTicketId: string | null): Promise<void> {
    await this.checkAndResetCacheIfNewDay();
    const traccarId = this.vehicleIdToTraccarId.get(vehicleId);
    if (traccarId === undefined) {
      this.logger.warn(`Intento de actualizar ticket para vehículo ${vehicleId} pero no existe en caché.`);
      return;
    }

    const currentState = this.cache.get(traccarId);
    if (currentState) {
      currentState.dailyTicketId = dailyTicketId;
      
      let driverName = 'No asignado';
      let driverId: string | null = null;
      let routeId: string | null = null;
      let direction: 'IDA' | 'VUELTA' | null = null;
      if (dailyTicketId) {
        try {
          const ticket = await this.ticketRepository.findOne({
            where: { id: dailyTicketId },
            relations: ['driver', 'rounds'],
          });
          if (ticket) {
            driverName = ticket.driver ? ticket.driver.name : 'No asignado';
            driverId = ticket.driverId || null;
            routeId = ticket.routeId || null;
            
            if (ticket.rounds && ticket.rounds.length > 0) {
              const activeRound = ticket.rounds.find(r => r.status === 'IN_PROGRESS') || ticket.rounds[ticket.rounds.length - 1];
              direction = activeRound ? (activeRound.direction as any) : 'IDA';
            } else {
              direction = 'IDA';
            }
          }
        } catch (error: any) {
          this.logger.error(`Error al obtener chofer y ruta para ticket en caliente: ${error.message}`);
        }
      }
      
      currentState.driverName = driverName;
      currentState.driverId = driverId;
      currentState.routeId = routeId;
      currentState.direction = direction;
      this.cache.set(traccarId, currentState);
      this.logger.log(`Caché actualizada en caliente: Vehículo ID ${vehicleId} -> Ticket ID ${dailyTicketId}, Chofer: ${driverName} (ID: ${driverId}), Ruta: ${routeId}, Dirección: ${direction}`);
      
      // Notificar reactivamente a los suscriptores (WebSockets)
      this.cacheUpdates$.next({ vehicleId, state: currentState });
    }
  }

  /**
   * Agrega o actualiza un vehículo completo en la caché (al crearlo o editarlo en el sistema)
   */
  setVehicleState(traccarDeviceId: number, state: CachedVehicleState): void {
    this.checkAndResetCacheIfNewDay().catch(err => 
      this.logger.error(`[Cache] Error al verificar auto-reinicio perezoso: ${err.message}`)
    );
    this.cache.set(traccarDeviceId, state);
    this.vehicleIdToTraccarId.set(state.vehicleId, traccarDeviceId);
    this.logger.log(`Vehículo registrado en caché de monitoreo: Traccar ID ${traccarDeviceId}`);
  }

  /**
   * Elimina un vehículo de la caché (al darlo de baja o cambiar su IMEI en el sistema)
   */
  removeVehicleState(traccarDeviceId: number, vehicleId?: string): void {
    this.cache.delete(traccarDeviceId);
    if (vehicleId) {
      this.vehicleIdToTraccarId.delete(vehicleId);
    }
    this.logger.log(`Vehículo de monitoreo removido de caché: Traccar ID ${traccarDeviceId}`);
  }

  /**
   * Valida si el día de hoy difiere del día en que se cargó la caché.
   * Si es así, realiza un auto-reinicio en segundo plano de manera asíncrona.
   */
  private async checkAndResetCacheIfNewDay(): Promise<void> {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const todayStr = formatter.format(new Date());

    if (this.lastLoadDate && this.lastLoadDate !== todayStr) {
      this.logger.log(`[Cache] Cambio de día detectado (Antes: ${this.lastLoadDate}, Ahora: ${todayStr}). Reiniciando y precargando caché...`);
      await this.resetCache();
    }
  }

  /**
   * Programa la tarea de medianoche (00:05) de forma autónoma con temporizadores puros.
   */
  private scheduleMidnightReset() {
    if (this.midnightTimeout) {
      clearTimeout(this.midnightTimeout);
    }

    const now = new Date();
    const midnight = new Date();
    
    // Programar para las 00:05 de la mañana del día siguiente
    midnight.setHours(24, 5, 0, 0);
    const msUntilMidnight = midnight.getTime() - now.getTime();

    this.logger.log(`[Cache] Programando reinicio automático diario de caché en ${Math.round(msUntilMidnight / 1000 / 60)} minutos (a las 00:05).`);

    this.midnightTimeout = setTimeout(async () => {
      this.logger.log('[Cache] Cron de medianoche activado. Reiniciando caché de tickets para el nuevo día...');
      try {
        await this.resetCache();
      } catch (error: any) {
        this.logger.error(`[Cache] Error en el reinicio programado a medianoche: ${error.message}`);
      }
      // Re-programar de forma recursiva para el próximo día
      this.scheduleMidnightReset();
    }, msUntilMidnight);
  }

  /**
   * Fuerza el reinicio completo de la caché en memoria y la hidratación desde la base de datos fresca.
   */
  async resetCache(): Promise<void> {
    this.logger.log('[Cache] Forzando el reinicio completo de la caché de vehículos y tickets...');

    // DESAFILIAR EN LOTE DE GRUPOS EN TRACCAR ANTES DE LIMPIAR LA MEMORIA
    try {
      const activeVehicles = Array.from(this.cache.entries())
        .filter(([traccarId, state]) => state.dailyTicketId !== null)
        .map(([traccarId, state]) => ({
          traccarId,
          plate: state.plate
        }));

      if (activeVehicles.length > 0) {
        this.logger.log(`[Cache - Fin de Día] Desafiliando ${activeVehicles.length} vehículo(s) de sus grupos de ruta en Traccar...`);
        const updatePromises = activeVehicles.map(async (v) => {
          // Busquemos en base de datos el vehículo para obtener su uniqueId (traccarDeviceId) real
          const vehicleObj = await this.vehicleRepository.findOne({ where: { traccarId: v.traccarId } });
          if (vehicleObj && vehicleObj.traccarDeviceId) {
            await this.traccarProvider.updateDevice(v.traccarId, {
              name: vehicleObj.plate,
              uniqueId: vehicleObj.traccarDeviceId,
              groupId: 0 // 0 remueve el grupo en la API de Traccar
            });
          }
        });
        
        await Promise.allSettled(updatePromises);
        this.logger.log(`[Cache - Fin de Día] Desafiliación en lote completada con éxito.`);
      }
    } catch (err: any) {
      this.logger.error(`[Cache - Fin de Día] Error al desafiliar vehículos en lote de Traccar: ${err.message}`);
    }

    this.preloadPromise = null;
    await this.preloadCache();
  }
}
