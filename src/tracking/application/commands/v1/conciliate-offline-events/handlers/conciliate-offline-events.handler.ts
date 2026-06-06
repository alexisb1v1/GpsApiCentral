import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { ConciliateOfflineEventsCommand } from '../conciliate-offline-events.command';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, EntityManager } from 'typeorm';
import { TrackingEventEntity, TrackingEventType } from '@tracking/domain/entities/tracking-event.entity';
import { RouteStopEntity } from '@route/domain/entities/route-stop.entity';
import { InfractionEntity, InfractionType, InfractionStatus } from '@infraction/domain/entities/infraction.entity';
import { VehicleEntity } from '@vehicle/domain/entities/vehicle.entity';
import { DailyRoundEntity, RoundsStatus } from '@daily-ticket/domain/entities/daily-round.entity';
import { DailyTicketRepository } from '@daily-ticket/domain/repositories/daily-ticket.repository';
import { DailyTicketEntity } from '@daily-ticket/domain/entities/daily-ticket.entity';
import { ITraccarProvider } from '@shared/infrastructure/traccar/traccar-provider.interface';
import { getLocalDateString, getLocalTimeString } from '@shared/utils/date.util';
import { DriverNotificationSentEvent } from '@monitoring/domain/events/driver-notification-sent.event';
import { VehicleTenantCache } from '@monitoring/infrastructure/cache/vehicle-tenant.cache';
import { randomUUID } from 'crypto';
import { ROUTE_DELAY_TOLERANCE_MINUTES } from '@shared/domain/constants/business.constants';


@CommandHandler(ConciliateOfflineEventsCommand)
export class ConciliateOfflineEventsHandler implements ICommandHandler<ConciliateOfflineEventsCommand> {
  private readonly logger = new Logger(ConciliateOfflineEventsHandler.name);

  constructor(
    @InjectRepository(VehicleEntity)
    private readonly vehicleRepository: Repository<VehicleEntity>,
    @Inject('DailyTicketRepository')
    private readonly dailyTicketRepository: DailyTicketRepository,
    @InjectRepository(TrackingEventEntity)
    private readonly trackingEventRepository: Repository<TrackingEventEntity>,
    @InjectRepository(RouteStopEntity)
    private readonly routeStopRepository: Repository<RouteStopEntity>,
    @InjectRepository(InfractionEntity)
    private readonly infractionRepository: Repository<InfractionEntity>,
    @InjectRepository(DailyRoundEntity)
    private readonly dailyRoundRepository: Repository<DailyRoundEntity>,
    @Inject('ITraccarProvider')
    private readonly traccarProvider: ITraccarProvider,
    private readonly eventBus: EventBus,
    private readonly vehicleTenantCache: VehicleTenantCache,
  ) {}

  async execute(command: ConciliateOfflineEventsCommand): Promise<void> {
    const { traccarDeviceId } = command;
    this.logger.log(`[Conciliación] Iniciando conciliación retrospectiva para el dispositivo Traccar ID: ${traccarDeviceId}`);

    // 1. Buscar Vehículo por traccarId
    const vehicle = await this.vehicleRepository.findOne({
      where: { traccarId: traccarDeviceId }
    });
    if (!vehicle) {
      this.logger.warn(`[Conciliación] No se encontró ningún vehículo con traccarId: ${traccarDeviceId}`);
      return;
    }

    // 2. Buscar Ticket Diario Activo
    const now = new Date();
    const todayStr = getLocalDateString(now);
    const ticketResult = await this.dailyTicketRepository.findActiveByVehicle(vehicle.id, todayStr);
    if (ticketResult.isErr() || !ticketResult.value) {
      this.logger.warn(`[Conciliación] No hay ticket diario activo para el vehículo ${vehicle.plate}`);
      return;
    }
    const ticket = ticketResult.value;

    // Ventana de consulta: Desde la creación del ticket hasta ahora
    const fromDate = ticket.createdAt;
    const toDate = new Date();

    this.logger.log(`[Conciliación] Consultando eventos en Traccar para ${vehicle.plate} desde ${fromDate.toISOString()} hasta ${toDate.toISOString()}`);
    const eventsResult = await this.traccarProvider.getDeviceEvents(traccarDeviceId, fromDate, toDate);
    if (eventsResult.isErr()) {
      this.logger.error(`[Conciliación] Error al obtener eventos de Traccar: ${eventsResult.error.message}`);
      return;
    }

    const traccarEvents = eventsResult.value;
    if (!traccarEvents || traccarEvents.length === 0) {
      this.logger.log(`[Conciliación] No se encontraron eventos de geocercas en Traccar para ${vehicle.plate}`);
      return;
    }

    this.logger.log(`[Conciliación] Encontrados ${traccarEvents.length} eventos en Traccar. Iniciando conciliación jerárquica...`);

    // Cargar todas las vueltas del ticket para mapear los eventos
    const rounds = await this.dailyRoundRepository.find({
      where: { dailyTicketId: ticket.id },
      order: { roundNumber: 'ASC' }
    });

    if (rounds.length === 0) {
      this.logger.warn(`[Conciliación] No se encontraron vueltas asociadas al ticket ${ticket.id}`);
      return;
    }

    // Procesar bajo transacción general de base de datos
    await this.trackingEventRepository.manager.transaction(async (manager) => {
      for (const tEvent of traccarEvents) {
        // Solo nos interesan geofenceEnter y geofenceExit
        if (tEvent.type !== 'geofenceEnter' && tEvent.type !== 'geofenceExit') continue;

        const eventTime = new Date(tEvent.eventTime);
        const geofenceId = tEvent.geofenceId;

        // Determinar a qué vuelta pertenece el evento según su hora
        let matchedRound = rounds.find(r => {
          if (!r.startTime) return false;
          const start = new Date(r.startTime);
          const end = r.endTime ? new Date(r.endTime) : null;
          return eventTime >= start && (end === null || eventTime <= end);
        });

        // Si no coincide por rango exacto, asociamos a la vuelta activa o a la última
        if (!matchedRound) {
          matchedRound = rounds.find(r => r.status === RoundsStatus.IN_PROGRESS) || 
                         rounds.find(r => r.status === RoundsStatus.PENDING) ||
                         rounds[rounds.length - 1];
        }

        if (!matchedRound) continue;

        const roundId = matchedRound.id;

        // Buscar si existe paradero en route_stops
        const routeStop = await manager.findOne(RouteStopEntity, {
          where: { traccarGeofenceId: geofenceId }
        });
        if (!routeStop) continue;

        if (tEvent.type === 'geofenceEnter') {
          // CONCILIACIÓN JERÁRQUICA
          const existingEvent = await manager.findOne(TrackingEventEntity, {
            where: {
              dailyTicketId: ticket.id,
              roundId,
              traccarGeofenceId: geofenceId,
              eventType: 'geofenceEnter' as any
            }
          });

          if (!existingEvent) {
            // Caso A: No existe el evento. El satélite lo detectó pero la PWA no lo reportó.
            // Lo insertamos como origen satélite
            const trackingEvent = new TrackingEventEntity();
            trackingEvent.dailyTicketId = ticket.id;
            trackingEvent.traccarGeofenceId = geofenceId;
            trackingEvent.roundId = roundId;
            trackingEvent.eventType = 'geofenceEnter' as any;
            trackingEvent.serverTime = eventTime;
            trackingEvent.latitude = 0; // Se puede dejar en 0 o null ya que no tenemos posicion lat/long directa en event report
            trackingEvent.longitude = 0;
            trackingEvent.durationSeconds = null;
            trackingEvent.rawPayload = { ...tEvent, source: 'TRACCAR' };

            await manager.save(trackingEvent);

            // Si es un CHECKPOINT, validar retraso y aplicar infracción oficial en PENDING
            if (routeStop.type === 'CHECKPOINT' && ticket.routeId && matchedRound.status === RoundsStatus.IN_PROGRESS) {
              await this.handleOfficialCheckpointDelay(
                manager,
                ticket,
                routeStop,
                eventTime,
                roundId,
                vehicle.tenantId
              );
            } else if (routeStop.type === 'END' && matchedRound.status === RoundsStatus.IN_PROGRESS) {
              await this.autoCompleteRound(manager, matchedRound, ticket, vehicle.id, eventTime);
            }
          } else {
            // Caso B: El evento ya existe.
            const source = existingEvent.rawPayload?.source;

            if (source === 'PWA') {
              // La PWA se adelantó, procedemos a actualizar/sobreescribir con datos satelitales oficiales (UPDATE)
              existingEvent.serverTime = eventTime;
              existingEvent.rawPayload = {
                ...tEvent,
                source: 'TRACCAR',
                audit: {
                  rectifiedByConciliation: true,
                  originalPwaTime: existingEvent.serverTime.toISOString(),
                  rectifiedTime: eventTime.toISOString()
                }
              };
              await manager.save(existingEvent);

              // Convalidar infracción tentativa
              if (routeStop.type === 'CHECKPOINT' && ticket.routeId) {
                await this.convalidateTentativeInfraction(
                  manager,
                  ticket,
                  routeStop,
                  eventTime,
                  roundId,
                  vehicle.tenantId
                );
              } else if (routeStop.type === 'END' && matchedRound.status === RoundsStatus.IN_PROGRESS) {
                await this.autoCompleteRound(manager, matchedRound, ticket, vehicle.id, eventTime);
              }
            }
            // Si el source === 'TRACCAR', omitimos (ya fue oficializado)
          }
        } else if (tEvent.type === 'geofenceExit') {
          // Registrar salida de geocerca en bitácora si no existe
          const existingExit = await manager.findOne(TrackingEventEntity, {
            where: {
              dailyTicketId: ticket.id,
              roundId,
              traccarGeofenceId: geofenceId,
              eventType: 'geofenceExit' as any
            }
          });

          if (!existingExit) {
            // Calcular duración si tenemos el enter
            let durationSeconds: number | null = null;
            const lastEnter = await manager.findOne(TrackingEventEntity, {
              where: {
                roundId,
                traccarGeofenceId: geofenceId,
                eventType: 'geofenceEnter' as any
              },
              order: { serverTime: 'DESC' }
            });

            if (lastEnter) {
              const diffMs = eventTime.getTime() - lastEnter.serverTime.getTime();
              durationSeconds = Math.max(0, Math.round(diffMs / 1000));
            }

            const trackingEvent = new TrackingEventEntity();
            trackingEvent.dailyTicketId = ticket.id;
            trackingEvent.traccarGeofenceId = geofenceId;
            trackingEvent.roundId = roundId;
            trackingEvent.eventType = 'geofenceExit' as any;
            trackingEvent.serverTime = eventTime;
            trackingEvent.latitude = 0;
            trackingEvent.longitude = 0;
            trackingEvent.durationSeconds = durationSeconds;
            trackingEvent.rawPayload = { ...tEvent, source: 'TRACCAR' };

            await manager.save(trackingEvent);
          }
        }
      }
    });

    this.logger.log(`[Conciliación] Conciliación retrospectiva para dispositivo ID ${traccarDeviceId} finalizada con éxito.`);
  }

  private async handleOfficialCheckpointDelay(
    manager: EntityManager,
    ticket: DailyTicketEntity,
    routeStop: RouteStopEntity,
    arrivalTime: Date,
    roundId: string,
    tenantId: string
  ) {
    const startStops = await manager.find(RouteStopEntity, {
      where: { routeId: ticket.routeId as string, type: 'START' as any }
    });
    const startGeofenceIds = startStops.map(s => s.traccarGeofenceId);
    if (startGeofenceIds.length === 0) return;

    const startEvent = await manager.findOne(TrackingEventEntity, {
      where: {
        roundId,
        eventType: 'geofenceEnter' as any,
        traccarGeofenceId: In(startGeofenceIds)
      }
    });

    if (!startEvent) return;

    const scheduledTime = new Date(startEvent.serverTime.getTime() + routeStop.minutesFromStart * 60000);
    const delayMinutes = (arrivalTime.getTime() - scheduledTime.getTime()) / 60000;

    if (delayMinutes > ROUTE_DELAY_TOLERANCE_MINUTES) {
      // Infracción oficial de satélite va directo a PENDING
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
      infraction.description = `[Satélite - Oficial] Retraso de ${Math.round(delayMinutes)} min en paradero ${routeStop.name || routeStop.id}. Programado: ${scheduledStr}, Real: ${arrivalStr}`;

      await manager.save(infraction);

      if (ticket.driverId) {
        this.eventBus.publish(
          new DriverNotificationSentEvent(ticket.driverId, {
            id: randomUUID(),
            type: 'INFRACTION',
            title: 'Alerta de Infracción Confirmada',
            message: infraction.description,
            timestamp: new Date(),
            data: {
              infractionId: infraction.id,
              amount: infraction.amount,
              delayMinutes: Math.round(delayMinutes),
            },
          })
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
      where: { routeId: ticket.routeId as string, type: 'START' as any }
    });
    const startGeofenceIds = startStops.map(s => s.traccarGeofenceId);
    if (startGeofenceIds.length === 0) return;

    const startEvent = await manager.findOne(TrackingEventEntity, {
      where: {
        roundId,
        eventType: 'geofenceEnter' as any,
        traccarGeofenceId: In(startGeofenceIds)
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

    if (delayMinutes > ROUTE_DELAY_TOLERANCE_MINUTES) {
      const desc = `[Satélite - Convalidado] Retraso de ${Math.round(delayMinutes)} min en paradero ${routeStop.name || routeStop.id}. Programado: ${scheduledStr}, Real: ${arrivalStr}`;
      
      if (existingTentative) {
        // Convalidar la infracción tentativa pasándola a PENDING
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
        // Crear una nueva infracción oficial si no existía preliminarmente
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
      // Si el satélite oficial demuestra que llegó a tiempo, anulamos la multa preliminar
      if (existingTentative) {
        existingTentative.status = InfractionStatus.ANNULLED;
        existingTentative.cancellationReason = `Anulada tras conciliación oficial de satélite. Tiempo de arribo correcto: ${arrivalStr}.`;
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
