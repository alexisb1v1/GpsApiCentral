import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ProcessTraccarWebhookCommand } from '../process-traccar-webhook.command';
import { randomUUID } from 'crypto';
import { DriverNotificationSentEvent } from '@monitoring/domain/events/driver-notification-sent.event';
import { VehicleRepository } from '@vehicle/domain/repositories/vehicle.repository';
import { VehicleEntity } from '@vehicle/domain/entities/vehicle.entity';
import { DailyTicketRepository } from '@daily-ticket/domain/repositories/daily-ticket.repository';
import { DailyTicketEntity, TicketStatus } from '@daily-ticket/domain/entities/daily-ticket.entity';
import { DailyRoundEntity } from '@daily-ticket/domain/entities/daily-round.entity';
import { TrackingEventEntity, TrackingEventType } from '@tracking/domain/entities/tracking-event.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, In, EntityManager } from 'typeorm';
import { RouteStopEntity } from '@route/domain/entities/route-stop.entity';
import { InfractionEntity, InfractionType, InfractionStatus } from '@infraction/domain/entities/infraction.entity';
import { VehicleTenantCache } from '@monitoring/infrastructure/cache/vehicle-tenant.cache';
import { RoundsStatus } from '@daily-ticket/domain/entities/daily-round.entity';
import { getLocalDateString, getLocalTimeString } from '@shared/utils/date.util';


export enum GeofenceType {
  START = 'START',
  CHECKPOINT = 'CHECKPOINT',
  END = 'END',
}

@CommandHandler(ProcessTraccarWebhookCommand)
export class ProcessTraccarWebhookHandler implements ICommandHandler<ProcessTraccarWebhookCommand> {
  constructor(
    @Inject('VehicleRepository')
    private readonly vehicleRepository: VehicleRepository,
    @Inject('DailyTicketRepository')
    private readonly dailyTicketRepository: DailyTicketRepository,
    @InjectRepository(TrackingEventEntity)
    private readonly trackingEventRepository: Repository<TrackingEventEntity>,
    @InjectRepository(RouteStopEntity)
    private readonly routeStopRepository: Repository<RouteStopEntity>,
    @InjectRepository(InfractionEntity)
    private readonly infractionRepository: Repository<InfractionEntity>,
    @InjectRepository(VehicleEntity)
    private readonly vehicleTypeOrmRepository: Repository<VehicleEntity>,
    @InjectRepository(DailyRoundEntity)
    private readonly dailyRoundRepository: Repository<DailyRoundEntity>,
    private readonly eventBus: EventBus,
    private readonly vehicleTenantCache: VehicleTenantCache,
  ) {}

  async execute(command: ProcessTraccarWebhookCommand): Promise<void> {
    const { payload } = command;
    const { event, device, position } = payload;

    if (!event || !event.deviceId) return;

    await this.trackingEventRepository.manager.transaction(async (transactionalManager) => {
      // 1. Buscar Vehículo por traccarId
      const vehicle = await transactionalManager.findOne(VehicleEntity, {
        where: { traccarId: event.deviceId }
      });
      if (!vehicle) return;

      // Si no viene geofenceId o position, no se procesa geocercas
      if (!event.geofenceId || !position || !position.fixTime || position.latitude === undefined || position.longitude === undefined) return;

      // 2. Buscar Paradero directamente en route_stops usando el traccarGeofenceId
      const routeStop = await transactionalManager.findOne(RouteStopEntity, {
        where: { traccarGeofenceId: event.geofenceId }
      });
      if (!routeStop) return;

      // 3. Buscar Ticket Diario Activo (para saber la Ruta) en la zona horaria local
      const today = getLocalDateString(new Date(position.fixTime));
      const ticket = await transactionalManager.findOne(DailyTicketEntity, {
        where: {
          vehicleId: vehicle.id,
          workDate: today as any,
          status: TicketStatus.ACTIVE
        }
      });
      if (!ticket) return;

      // 3.1. Obtener la vuelta activa
      const activeRound = await transactionalManager.findOne(DailyRoundEntity, {
        where: [
          { dailyTicketId: ticket.id, status: RoundsStatus.IN_PROGRESS },
          { dailyTicketId: ticket.id, status: RoundsStatus.PENDING }
        ],
        order: { roundNumber: 'DESC' }
      });
      const roundId = activeRound ? activeRound.id : null;
      if (!roundId) return;

      const eventTime = new Date(position.fixTime);

      if (event.type === 'geofenceEnter') {
        // CONCILIACIÓN JERÁRQUICA
        const existingEvent = await transactionalManager.findOne(TrackingEventEntity, {
          where: {
            dailyTicketId: ticket.id,
            roundId,
            traccarGeofenceId: event.geofenceId,
            eventType: 'geofenceEnter' as any
          }
        });

        if (existingEvent) {
          const source = existingEvent.rawPayload?.source;

          if (source === 'PWA') {
            // Caso B: El satélite llega después que la PWA. UPDATE con datos del satélite.
            existingEvent.serverTime = eventTime;
            existingEvent.latitude = position.latitude;
            existingEvent.longitude = position.longitude;
            existingEvent.rawPayload = {
              ...payload,
              source: 'TRACCAR',
              audit: {
                rectifiedByRealTimeWebhook: true,
                originalPwaTime: existingEvent.serverTime.toISOString(),
                rectifiedTime: eventTime.toISOString()
              }
            };
            await transactionalManager.save(existingEvent);

            // Convalidar infracción tentativa
            if (routeStop.type === GeofenceType.CHECKPOINT && ticket.routeId) {
              await this.convalidateTentativeInfraction(
                transactionalManager,
                ticket,
                routeStop,
                eventTime,
                roundId,
                vehicle.tenantId
              );
            } else if (routeStop.type === GeofenceType.END && activeRound?.status === RoundsStatus.IN_PROGRESS) {
              await this.autoCompleteRound(transactionalManager, activeRound, ticket, vehicle.id, eventTime);
            }
          }
          // Si el source === 'TRACCAR', es un evento duplicado del satélite, lo ignoramos
          return;
        }

        // Caso A: No existe el evento. Es un ingreso regular detectado por satélite.
        const trackingEvent = new TrackingEventEntity();
        trackingEvent.tenantId = vehicle.tenantId;
        trackingEvent.dailyTicketId = ticket.id;
        trackingEvent.traccarGeofenceId = event.geofenceId;
        trackingEvent.roundId = roundId;
        trackingEvent.eventType = 'geofenceEnter' as any;
        trackingEvent.serverTime = eventTime;
        trackingEvent.latitude = position.latitude;
        trackingEvent.longitude = position.longitude;
        trackingEvent.durationSeconds = null;
        trackingEvent.rawPayload = { ...payload, source: 'TRACCAR' }; // Marcado como origen TRACCAR

        await transactionalManager.save(trackingEvent);

        if (routeStop.type === GeofenceType.END && activeRound && activeRound.status === RoundsStatus.IN_PROGRESS) {
          await this.autoCompleteRound(transactionalManager, activeRound, ticket, vehicle.id, eventTime);
          return;
        }

        if (routeStop.type === GeofenceType.CHECKPOINT && ticket.routeId && activeRound?.status === RoundsStatus.IN_PROGRESS) {
          // Notificar en tiempo real al conductor
          if (ticket.driverId) {
            this.eventBus.publish(
              new DriverNotificationSentEvent(ticket.driverId, {
                id: randomUUID(),
                type: 'CHECKPOINT_MARKED',
                title: 'Control Marcado',
                message: `Has ingresado a: ${routeStop.name || 'Punto de control'}`,
                timestamp: new Date(),
                data: {
                  traccarGeofenceId: routeStop.traccarGeofenceId,
                  stopOrder: routeStop.stopOrder,
                },
              }),
            );
          }

          await this.handleCheckpoint(
            transactionalManager,
            ticket,
            routeStop.traccarGeofenceId,
            ticket.routeId,
            eventTime,
            vehicle.tenantId,
            roundId
          );
        }

      } else if (event.type === 'geofenceExit') {
        // Procesar salida de geocerca de forma transaccional
        const existingExit = await transactionalManager.findOne(TrackingEventEntity, {
          where: {
            dailyTicketId: ticket.id,
            roundId,
            traccarGeofenceId: event.geofenceId,
            eventType: 'geofenceExit' as any
          }
        });

        if (!existingExit) {
          let durationSeconds: number | null = null;
          const lastEnterEvent = await transactionalManager.findOne(TrackingEventEntity, {
            where: {
              roundId,
              traccarGeofenceId: event.geofenceId,
              eventType: 'geofenceEnter' as any
            },
            order: { serverTime: 'DESC' }
          });
          if (lastEnterEvent) {
            const exitTime = new Date(position.fixTime);
            const enterTime = lastEnterEvent.serverTime;
            const diffInMilliseconds = exitTime.getTime() - enterTime.getTime();
            durationSeconds = Math.max(0, Math.round(diffInMilliseconds / 1000));
          }

          const trackingEvent = new TrackingEventEntity();
          trackingEvent.tenantId = vehicle.tenantId;
          trackingEvent.dailyTicketId = ticket.id;
          trackingEvent.traccarGeofenceId = event.geofenceId;
          trackingEvent.roundId = roundId;
          trackingEvent.eventType = event.type as any;
          trackingEvent.serverTime = eventTime;
          trackingEvent.latitude = position.latitude;
          trackingEvent.longitude = position.longitude;
          trackingEvent.durationSeconds = durationSeconds;
          trackingEvent.rawPayload = { ...payload, source: 'TRACCAR' };
          
          await transactionalManager.save(trackingEvent);
        }
      }
    });
  }

  private async handleCheckpoint(
    manager: EntityManager,
    ticket: DailyTicketEntity, 
    traccarGeofenceId: number, 
    routeId: string, 
    arrivalTime: Date, 
    tenantId: string,
    roundId: string
  ) {
    const routeStop = await manager.findOne(RouteStopEntity, {
      where: { routeId, traccarGeofenceId }
    });
    if (!routeStop) return;

    const startStops = await manager.find(RouteStopEntity, {
      where: { routeId, type: GeofenceType.START }
    });
    const startGeofenceIds = startStops.map(s => s.traccarGeofenceId);
    if (startGeofenceIds.length === 0) return;

    // BÚSQUEDA OPTIMIZADA: Aislamiento por Vuelta
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

    if (delayMinutes > 2) {
      const infraction = new InfractionEntity();
      infraction.tenantId = tenantId;
      infraction.vehicleId = ticket.vehicleId;
      infraction.userId = ticket.driverId || '';
      infraction.dailyTicketId = ticket.id;
      infraction.roundId = roundId;
      infraction.type = InfractionType.RETRASO_RUTA;
      infraction.amount = 10.00;
      infraction.status = InfractionStatus.PENDING; // Webhook directo es oficial (PENDING)
      
      const scheduledStr = getLocalTimeString(scheduledTime);
      const arrivalStr = getLocalTimeString(arrivalTime);
      
      infraction.description = `[Satélite - Oficial] Retraso de ${Math.round(delayMinutes)} min en paradero ${routeStop.name || routeStop.id}. Programado: ${scheduledStr}, Real: ${arrivalStr}`;
      
      await manager.save(infraction);

      if (ticket.driverId) {
        this.eventBus.publish(
          new DriverNotificationSentEvent(ticket.driverId, {
            id: randomUUID(),
            type: 'INFRACTION',
            title: 'Alerta de Infracción',
            message: infraction.description,
            timestamp: new Date(),
            data: {
              infractionId: infraction.id,
              amount: infraction.amount,
              delayMinutes: Math.round(delayMinutes),
              traccarGeofenceId: routeStop.traccarGeofenceId,
            },
          }),
        );
      }
    }
  }

  private async convalidateTentativeInfraction(
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

    // Buscar si la PWA reportó una infracción tentative preliminar
    const existingTentative = await manager.findOne(InfractionEntity, {
      where: {
        dailyTicketId: ticket.id,
        roundId,
        type: InfractionType.RETRASO_RUTA,
        status: InfractionStatus.TENTATIVE
      }
    });

    if (delayMinutes > 2) {
      const desc = `[Satélite - Convalidado] Retraso de ${Math.round(delayMinutes)} min en paradero ${routeStop.name || routeStop.id}. Programado: ${scheduledStr}, Real: ${arrivalStr}`;
      
      if (existingTentative) {
        existingTentative.status = InfractionStatus.PENDING;
        existingTentative.description = desc;
        await manager.save(existingTentative);

        if (ticket.driverId) {
          this.eventBus.publish(
            new DriverNotificationSentEvent(ticket.driverId, {
              id: randomUUID(),
              type: 'INFRACTION',
              title: 'Alerta de Infracción Convalidada',
              message: desc,
              timestamp: new Date(),
              data: {
                infractionId: existingTentative.id,
                amount: existingTentative.amount,
                delayMinutes: Math.round(delayMinutes),
              },
            })
          );
        }
      } else {
        const infraction = new InfractionEntity();
        infraction.tenantId = tenantId;
        infraction.vehicleId = ticket.vehicleId;
        infraction.userId = ticket.driverId || '';
        infraction.dailyTicketId = ticket.id;
        infraction.roundId = roundId;
        infraction.type = InfractionType.RETRASO_RUTA;
        infraction.amount = 10.00;
        infraction.status = InfractionStatus.PENDING;
        infraction.description = desc;
        await manager.save(infraction);
      }
    } else {
      // Satélite demuestra que llegó a tiempo, anulamos multa preliminar
      if (existingTentative) {
        existingTentative.status = InfractionStatus.ANNULLED;
        existingTentative.cancellationReason = `Anulada tras convalidación en tiempo real por satélite. Tiempo de arribo oficial: ${arrivalStr}.`;
        existingTentative.description = `[Satélite - Anulada] Cruce a tiempo verificado por satélite. Programado: ${scheduledStr}, Real: ${arrivalStr}`;
        await manager.save(existingTentative);
      }
    }
  }

  private async autoCompleteRound(
    manager: EntityManager,
    activeRound: DailyRoundEntity,
    ticket: DailyTicketEntity,
    vehicleId: string,
    arrivalTime: Date
  ): Promise<void> {
    if (activeRound.status !== RoundsStatus.IN_PROGRESS) return;

    activeRound.status = RoundsStatus.COMPLETED;
    activeRound.endTime = arrivalTime;
    await manager.save(activeRound);

    const nextDirection = activeRound.direction === 'IDA' ? 'VUELTA' : 'IDA';

    const nextRound = new DailyRoundEntity();
    nextRound.dailyTicketId = ticket.id;
    nextRound.roundNumber = activeRound.roundNumber + 1;
    nextRound.direction = nextDirection;
    nextRound.status = RoundsStatus.PENDING;
    await manager.save(nextRound);

    await this.vehicleTenantCache.setDailyTicketId(vehicleId, ticket.id);
  }
}
