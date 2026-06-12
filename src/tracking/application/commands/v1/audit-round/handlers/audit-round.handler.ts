import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, EntityManager } from 'typeorm';
import { Redis } from 'ioredis';
import { AuditRoundCommand } from '../audit-round.command';
import { DailyRoundEntity, RoundsStatus } from '@daily-ticket/domain/entities/daily-round.entity';
import { DailyTicketEntity } from '@daily-ticket/domain/entities/daily-ticket.entity';
import { VehicleEntity } from '@vehicle/domain/entities/vehicle.entity';
import { RouteStopEntity } from '@route/domain/entities/route-stop.entity';
import { TrackingEventEntity, TrackingEventType } from '@tracking/domain/entities/tracking-event.entity';
import { InfractionEntity, InfractionType, InfractionStatus } from '@infraction/domain/entities/infraction.entity';
import { ITraccarProvider } from '@shared/infrastructure/traccar/traccar-provider.interface';
import { getLocalDateString, getLocalTimeString } from '@shared/utils/date.util';
import { ROUTE_DELAY_TOLERANCE_MINUTES } from '@shared/domain/constants/business.constants';
import { TenantEntity } from '@tenant/domain/entities/tenant.entity';

export enum GeofenceType {
  START = 'START',
  CHECKPOINT = 'CHECKPOINT',
  END = 'END',
}

@CommandHandler(AuditRoundCommand)
export class AuditRoundHandler implements ICommandHandler<AuditRoundCommand> {
  constructor(
    @InjectRepository(DailyRoundEntity)
    private readonly roundRepository: Repository<DailyRoundEntity>,
    @InjectRepository(DailyTicketEntity)
    private readonly ticketRepository: Repository<DailyTicketEntity>,
    @InjectRepository(TrackingEventEntity)
    private readonly trackingEventRepository: Repository<TrackingEventEntity>,
    @InjectRepository(RouteStopEntity)
    private readonly routeStopRepository: Repository<RouteStopEntity>,
    @InjectRepository(InfractionEntity)
    private readonly infractionRepository: Repository<InfractionEntity>,
    @InjectRepository(TenantEntity)
    private readonly tenantRepository: Repository<TenantEntity>,
    @Inject('ITraccarProvider')
    private readonly traccarProvider: ITraccarProvider,
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
  ) {}

  async execute(command: AuditRoundCommand): Promise<void> {
    const { roundId, isIncomplete } = command;

    await this.trackingEventRepository.manager.transaction(async (transactionalManager) => {
      // 1. Obtener la vuelta
      const round = await transactionalManager.findOne(DailyRoundEntity, {
        where: { id: roundId }
      });
      if (!round) return;

      // 2. Obtener el ticket asociado
      const ticket = await transactionalManager.findOne(DailyTicketEntity, {
        where: { id: round.dailyTicketId }
      });
      if (!ticket) return;

      // 3. Obtener el vehículo
      const vehicle = await transactionalManager.findOne(VehicleEntity, {
        where: { id: ticket.vehicleId }
      });
      if (!vehicle || !vehicle.traccarId) return;

      // 4. Obtener el Tenant para construir la clave del Hash de Redis
      const tenant = await transactionalManager.findOne(TenantEntity, {
        where: { id: vehicle.tenantId }
      });
      if (!tenant) return;

      const tenantSlug = tenant.subdomain;
      const doubleCheckHash = `${tenantSlug}_cache_doblecheck`;

      // 5. Determinar rango de tiempo de la vuelta
      const startTime = round.startTime || round.createdAt;
      const endTime = round.endTime || new Date();

      this.trackingEventRepository.manager.connection.logger.log('info', `[AuditRound] Iniciando auditoría para Vuelta ID ${roundId} (Vehículo: ${vehicle.plate}, Modo Incompleto: ${isIncomplete})`);

      if (!isIncomplete) {
        // OBTENER HISTÓRICO DE POSICIONES DESDE TRACCAR
        const positionsResult = await this.traccarProvider.getDevicePositions(vehicle.traccarId, startTime, endTime);
        if (positionsResult.isOk()) {
          const positions = positionsResult.value;
          
          if (positions.length > 0) {
            // Ordenar cronológicamente
            positions.sort((a, b) => new Date(a.deviceTime || a.fixTime).getTime() - new Date(b.deviceTime || b.fixTime).getTime());

            // Obtener paraderos de la ruta activa en este sentido
            const routeStops = await transactionalManager.find(RouteStopEntity, {
              where: { routeId: ticket.routeId as string, direction: round.direction as 'IDA' | 'VUELTA' }
            });

            for (const stop of routeStops) {
              // Buscar si ya existe la marca de entrada oficial de Traccar
              const existingEnter = await transactionalManager.findOne(TrackingEventEntity, {
                where: {
                  roundId,
                  traccarGeofenceId: stop.traccarGeofenceId,
                  eventType: 'geofenceEnter' as any
                }
              });

              let arrivalTime: Date | null = null;
              let wasInterpolated = false;

              if (!existingEnter) {
                // EVALUAR INTERPOLACIÓN LINEAL EN EL HISTÓRICO
                for (let i = 0; i < positions.length - 1; i++) {
                  const prevPos = positions[i];
                  const currPos = positions[i + 1];

                  const prevCoords = { lat: parseFloat(prevPos.latitude || prevPos.lat), lng: parseFloat(prevPos.longitude || prevPos.lng) };
                  const currCoords = { lat: parseFloat(currPos.latitude || currPos.lat), lng: parseFloat(currPos.longitude || currPos.lng) };

                  const sumLat = stop.coordinates ? stop.coordinates.reduce((sum, c) => sum + c.lat, 0) : stop.coordinates ? 0 : 0;
                  const sumLng = stop.coordinates ? stop.coordinates.reduce((sum, c) => sum + c.lng, 0) : stop.coordinates ? 0 : 0;
                  const stopCenter = stop.coordinates && stop.coordinates.length > 0
                    ? { lat: sumLat / stop.coordinates.length, lng: sumLng / stop.coordinates.length }
                    : null;

                  if (stopCenter) {
                    const evalResult = getMinimumDistanceToSegment(prevCoords, currCoords, stopCenter);
                    
                    if (evalResult.distanceMeters <= 40) {
                      // El bus cruzó la zona. Estimar hora.
                      const prevTime = new Date(prevPos.deviceTime || prevPos.fixTime);
                      const currTime = new Date(currPos.deviceTime || currPos.fixTime);
                      const timeDiff = currTime.getTime() - prevTime.getTime();
                      
                      arrivalTime = new Date(prevTime.getTime() + evalResult.f * timeDiff);
                      wasInterpolated = true;
                      break; // Ya encontramos el cruce de este paradero
                    }
                  }
                }

                if (arrivalTime && wasInterpolated) {
                  // Registrar el paso por paradero recuperado por la auditoría
                  const trackingEvent = new TrackingEventEntity();
                  trackingEvent.dailyTicketId = ticket.id;
                  trackingEvent.traccarGeofenceId = stop.traccarGeofenceId;
                  trackingEvent.roundId = roundId;
                  trackingEvent.eventType = 'geofenceEnter' as any;
                  trackingEvent.serverTime = arrivalTime;
                  trackingEvent.latitude = stop.coordinates ? stop.coordinates[0].lat : 0;
                  trackingEvent.longitude = stop.coordinates ? stop.coordinates[0].lng : 0;
                  trackingEvent.rawPayload = { source: 'TRACCAR_AUDIT', note: 'Recuperado por auditoría de doble check' };
                  
                  await transactionalManager.save(trackingEvent);

                  // Evaluar si corresponde sanción oficial por retraso
                  if (stop.type === GeofenceType.CHECKPOINT) {
                    await this.auditCheckpointDelay(transactionalManager, ticket, stop, arrivalTime, roundId, vehicle.tenantId);
                  }
                }
              } else {
                // LA MARCA YA EXISTE: Validar multas TENTATIVE asociadas
                arrivalTime = existingEnter.serverTime;
                
                if (stop.type === GeofenceType.CHECKPOINT) {
                  // Convalidar o anular cualquier multa tentativa preliminar de la PWA
                  await this.convalidateOrAnnulTentative(transactionalManager, ticket, stop, arrivalTime, roundId, vehicle.tenantId);
                }
              }
            }
          }
        }
      } else {
        // CASO INCOMPLETO (El GPS no terminó de reportar/se apagó)
        // Convalidar las multas TENTATIVE que quedaron colgadas en base de datos ya que no hay satélite oficial para refutarlas
        const tentativeInfractions = await transactionalManager.find(InfractionEntity, {
          where: {
            roundId,
            status: InfractionStatus.TENTATIVE
          }
        });

        for (const infraction of tentativeInfractions) {
          infraction.status = InfractionStatus.PENDING; // Se oficializa la de la PWA por defecto ante falta de satélite
          const desc = infraction.description || '';
          infraction.description = `[PWA - Oficializado por Incompleto] ` + desc.replace('[PWA - Tentativa] ', '');
          await transactionalManager.save(infraction);
        }
      }

      // 6. Actualizar estado de la vuelta a COMPLETED
      round.status = RoundsStatus.COMPLETED;
      if (!round.endTime) {
        round.endTime = endTime;
      }
      await transactionalManager.save(round);

      // 7. Registrar estado de la auditoría en Redis
      const auditResult = {
        status: 'AUDITED',
        attempts: 1,
        lastAttempt: new Date().toISOString(),
        isAuditIncomplete: isIncomplete
      };
      await this.redis.hset(doubleCheckHash, roundId, JSON.stringify(auditResult));
    });
  }

  private async auditCheckpointDelay(
    manager: EntityManager,
    ticket: DailyTicketEntity,
    routeStop: RouteStopEntity,
    arrivalTime: Date,
    roundId: string,
    tenantId: string
  ) {
    const startStops = await manager.find(RouteStopEntity, {
      where: { routeId: ticket.routeId as string, type: GeofenceType.START }
    });
    const startGeofenceIds = startStops.map(s => s.traccarGeofenceId);
    if (startGeofenceIds.length === 0) return;

    const startEvent = await manager.findOne(TrackingEventEntity, {
      where: {
        roundId,
        eventType: 'geofenceEnter' as any,
        traccarGeofenceId: In(startGeofenceIds),
      }
    });

    if (!startEvent) return;

    const scheduledTime = new Date(startEvent.serverTime.getTime() + routeStop.minutesFromStart * 60000);
    const delayMinutes = (arrivalTime.getTime() - scheduledTime.getTime()) / 60000;

    if (delayMinutes > ROUTE_DELAY_TOLERANCE_MINUTES) {
      const infraction = new InfractionEntity();
      infraction.tenantId = tenantId;
      infraction.vehicleId = ticket.vehicleId;
      infraction.userId = ticket.driverId || '';
      infraction.dailyTicketId = ticket.id;
      infraction.roundId = roundId;
      infraction.type = InfractionType.RETRASO_RUTA;
      infraction.amount = 10.00;
      infraction.status = InfractionStatus.PENDING;
      
      const scheduledStr = getLocalTimeString(scheduledTime);
      const arrivalStr = getLocalTimeString(arrivalTime);
      infraction.description = `[Satélite - Auditoría] Retraso de ${Math.round(delayMinutes)} min en paradero ${routeStop.name || routeStop.id}. Programado: ${scheduledStr}, Real: ${arrivalStr}`;
      
      await manager.save(infraction);
    }
  }

  private async convalidateOrAnnulTentative(
    manager: EntityManager,
    ticket: DailyTicketEntity,
    routeStop: RouteStopEntity,
    arrivalTime: Date,
    roundId: string,
    tenantId: string
  ) {
    const startStops = await manager.find(RouteStopEntity, {
      where: { routeId: ticket.routeId as string, type: GeofenceType.START }
    });
    const startGeofenceIds = startStops.map(s => s.traccarGeofenceId);
    if (startGeofenceIds.length === 0) return;

    const startEvent = await manager.findOne(TrackingEventEntity, {
      where: {
        roundId,
        eventType: 'geofenceEnter' as any,
        traccarGeofenceId: In(startGeofenceIds),
      }
    });

    if (!startEvent) return;

    const scheduledTime = new Date(startEvent.serverTime.getTime() + routeStop.minutesFromStart * 60000);
    const delayMinutes = (arrivalTime.getTime() - scheduledTime.getTime()) / 60000;

    const scheduledStr = getLocalTimeString(scheduledTime);
    const arrivalStr = getLocalTimeString(arrivalTime);

    // Buscar si existe una multa TENTATIVE generada por la PWA
    const existingTentative = await manager.findOne(InfractionEntity, {
      where: {
        roundId,
        dailyTicketId: ticket.id,
        type: InfractionType.RETRASO_RUTA,
        status: InfractionStatus.TENTATIVE
      }
    });

    if (delayMinutes > ROUTE_DELAY_TOLERANCE_MINUTES) {
      if (existingTentative) {
        existingTentative.status = InfractionStatus.PENDING;
        existingTentative.description = `[Satélite - Convalidado] Retraso de ${Math.round(delayMinutes)} min en paradero ${routeStop.name || routeStop.id}. Programado: ${scheduledStr}, Real: ${arrivalStr}`;
        await manager.save(existingTentative);
      } else {
        // Si no existía de la PWA pero el satélite oficial demuestra que sí hubo retraso
        const infraction = new InfractionEntity();
        infraction.tenantId = tenantId;
        infraction.vehicleId = ticket.vehicleId;
        infraction.userId = ticket.driverId || '';
        infraction.dailyTicketId = ticket.id;
        infraction.roundId = roundId;
        infraction.type = InfractionType.RETRASO_RUTA;
        infraction.amount = 10.00;
        infraction.status = InfractionStatus.PENDING;
        infraction.description = `[Satélite - Oficial] Retraso de ${Math.round(delayMinutes)} min en paradero ${routeStop.name || routeStop.id}. Programado: ${scheduledStr}, Real: ${arrivalStr}`;
        await manager.save(infraction);
      }
    } else {
      // Satélite demuestra que pasó a tiempo, anulamos multa preliminar
      if (existingTentative) {
        existingTentative.status = InfractionStatus.ANNULLED;
        existingTentative.cancellationReason = `Anulada tras auditoría de final de ruta. Tiempo de arribo oficial satelital: ${arrivalStr} demuestra cumplimiento.`;
        existingTentative.description = `[Satélite - Anulada] Cruce verificado a tiempo por satélite. Programado: ${scheduledStr}, Real: ${arrivalStr}`;
        await manager.save(existingTentative);
      }
    }
  }
}

function getMinimumDistanceToSegment(
  prev: { lat: number; lng: number },
  curr: { lat: number; lng: number },
  stop: { lat: number; lng: number }
): { distanceMeters: number; f: number } {
  const latRad = (prev.lat * Math.PI) / 180;
  const cosLat = Math.cos(latRad);

  const xPrev = prev.lng * cosLat;
  const yPrev = prev.lat;
  
  const xCurr = curr.lng * cosLat;
  const yCurr = curr.lat;
  
  const xStop = stop.lng * cosLat;
  const yStop = stop.lat;

  const dx = xCurr - xPrev;
  const dy = yCurr - yPrev;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    const distGrados = Math.sqrt((xStop - xPrev) * (xStop - xPrev) + (yStop - yPrev) * (yStop - yPrev));
    return { distanceMeters: distGrados * 111320, f: 0 };
  }

  const f = ((xStop - xPrev) * dx + (yStop - yPrev) * dy) / lenSq;
  const clampedF = Math.max(0, Math.min(1, f));

  const xProj = xPrev + clampedF * dx;
  const yProj = yPrev + clampedF * dy;

  const distGrados = Math.sqrt((xStop - xProj) * (xStop - xProj) + (yStop - yProj) * (yStop - yProj));
  return { distanceMeters: distGrados * 111320, f: clampedF };
}
