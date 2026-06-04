import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ProcessTraccarWebhookCommand } from '../process-traccar-webhook.command';
import { randomUUID } from 'crypto';
import { DriverNotificationSentEvent } from '@monitoring/domain/events/driver-notification-sent.event';
import { VehicleRepository } from '@vehicle/domain/repositories/vehicle.repository';
import { VehicleEntity } from '@vehicle/domain/entities/vehicle.entity';
import { DailyTicketRepository } from '@daily-ticket/domain/repositories/daily-ticket.repository';
import { DailyTicketEntity } from '@daily-ticket/domain/entities/daily-ticket.entity';
import { DailyRoundEntity } from '@daily-ticket/domain/entities/daily-round.entity';
import { TrackingEventEntity, TrackingEventType } from '@tracking/domain/entities/tracking-event.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, In } from 'typeorm';
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

    // 1. Buscar Vehículo por traccarId (ID numérico que envía Traccar en event.deviceId / device.id)
    const vehicle = await this.vehicleTypeOrmRepository.findOne({
      where: { traccarId: event.deviceId }
    });
    if (!vehicle) return;

    // Si no viene geofenceId o position (ej. evento deviceOnline), no se procesa geocercas
    if (!event.geofenceId || !position || !position.fixTime) return;

    // 2. Buscar Paradero directamente en route_stops usando el traccarGeofenceId
    const routeStop = await this.routeStopRepository.findOne({
      where: { traccarGeofenceId: event.geofenceId }
    });
    if (!routeStop) return;

    // 3. Buscar Ticket Diario Activo (para saber la Ruta) en la zona horaria local (America/Lima / Pucallpa)
    const today = getLocalDateString(new Date(position.fixTime));
    const ticketResult = await this.dailyTicketRepository.findActiveByVehicle(vehicle.id, today);
    if (ticketResult.isErr() || !ticketResult.value) return;
    const ticket = ticketResult.value;

    // 3.1. Obtener el round (vuelta) activa actual de este ticket en Postgres (puede estar PENDING o IN_PROGRESS)
    const activeRound = await this.dailyRoundRepository.findOne({
      where: [
        { dailyTicketId: ticket.id, status: RoundsStatus.IN_PROGRESS },
        { dailyTicketId: ticket.id, status: RoundsStatus.PENDING }
      ],
      order: { roundNumber: 'DESC' }
    });
    const roundId = activeRound ? activeRound.id : null;

    // 3.3. Idempotencia y Algoritmo de Conciliación Horaria (Prevención de Fraude)
    if (event.type === 'geofenceEnter' && roundId) {
      const existingEvent = await this.trackingEventRepository.findOne({
        where: {
          dailyTicketId: ticket.id,
          roundId,
          traccarGeofenceId: event.geofenceId,
          eventType: 'geofenceEnter' as any
        }
      });

      if (existingEvent) {
        const satTime = new Date(position.fixTime);
        const pwaTime = existingEvent.serverTime;
        const timeDiffMs = Math.abs(satTime.getTime() - pwaTime.getTime());

        // Si la diferencia horaria es drástica (mayor a 3 minutos), rectificamos
        if (timeDiffMs > 3 * 60 * 1000) {
          existingEvent.serverTime = satTime;
          existingEvent.rawPayload = {
            ...existingEvent.rawPayload,
            audit: {
              rectifiedByTraccar: true,
              originalPwaTime: pwaTime.toISOString(),
              rectifiedTime: satTime.toISOString(),
              desfaseMinutes: timeDiffMs / 60000
            }
          };
          await this.trackingEventRepository.save(existingEvent);

          // Si es un checkpoint intermedio, recalcular e infraccionar si es necesario
          if (routeStop.type === GeofenceType.CHECKPOINT && ticket.routeId) {
            await this.recalculateOfflineInfraction(
              ticket,
              routeStop,
              satTime,
              roundId,
              vehicle.tenantId
            );
          }
        }
        
        // Retornar (evitamos duplicar el registro)
        return;
      }
    }

    // 3.2. Si el evento es 'geofenceExit' (Salida de paradero), calcular el tiempo de estadía en segundos
    let durationSeconds: number | null = null;
    if (event.type === 'geofenceExit' && roundId) {
      const lastEnterEvent = await this.trackingEventRepository.findOne({
        where: {
          roundId,
          traccarGeofenceId: event.geofenceId,
          eventType: 'geofenceEnter' as any // ENTER
        },
        order: { serverTime: 'DESC' }
      });
      if (lastEnterEvent) {
        const exitTime = new Date(position.fixTime);
        const enterTime = lastEnterEvent.serverTime;
        const diffInMilliseconds = exitTime.getTime() - enterTime.getTime();
        durationSeconds = Math.max(0, Math.round(diffInMilliseconds / 1000));
      }
    }

    // 4. Registrar el Evento de Tracking (La Bitácora) con roundId y durationSeconds
    const trackingEvent = new TrackingEventEntity();
    trackingEvent.tenantId = vehicle.tenantId;
    trackingEvent.dailyTicketId = ticket.id;
    trackingEvent.traccarGeofenceId = event.geofenceId;
    trackingEvent.roundId = roundId;
    trackingEvent.eventType = event.type as any;
    trackingEvent.serverTime = new Date(position.fixTime);
    trackingEvent.latitude = position.latitude;
    trackingEvent.longitude = position.longitude;
    trackingEvent.durationSeconds = durationSeconds;
    trackingEvent.rawPayload = payload;
    await this.trackingEventRepository.save(trackingEvent);

    // 5. Regla de Negocio: Solo procesamos ENTRADAS para penalidades
    if (event.type !== 'geofenceEnter') return;

    // 5.1. Si es paradero final (END) y la vuelta activa estaba IN_PROGRESS, completarla y generar vuelta de retorno en PENDING
    if (routeStop.type === GeofenceType.END && activeRound && activeRound.status === RoundsStatus.IN_PROGRESS) {
      await this.autoCompleteRound(activeRound, ticket, vehicle.id, new Date(position.fixTime));
      return;
    }

    // 6. Si es paradero intermedio (CHECKPOINT), verificar retraso (solo si la vuelta está activa IN_PROGRESS)
    if (routeStop.type === GeofenceType.CHECKPOINT && ticket.routeId && roundId && activeRound?.status === RoundsStatus.IN_PROGRESS) {
      // Notificar en tiempo real al conductor que el control fue marcado exitosamente
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
        ticket, 
        routeStop.traccarGeofenceId, 
        ticket.routeId, 
        trackingEvent.serverTime, 
        vehicle.tenantId,
        roundId
      );
    }
  }

  private async handleCheckpoint(
    ticket: DailyTicketEntity, 
    traccarGeofenceId: number, 
    routeId: string, 
    arrivalTime: Date, 
    tenantId: string,
    roundId: string
  ) {
    const routeStop = await this.routeStopRepository.findOne({
      where: { routeId, traccarGeofenceId }
    });
    if (!routeStop) return;

    const startStops = await this.routeStopRepository.find({
      where: { routeId, type: GeofenceType.START }
    });
    const startGeofenceIds = startStops.map(s => s.traccarGeofenceId);
    if (startGeofenceIds.length === 0) return;

    // BÚSQUEDA OPTIMIZADA: Aislamiento por Vuelta (Evita cruces con viajes anteriores del mismo día)
    const startEvent = await this.trackingEventRepository.findOne({
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
      infraction.status = InfractionStatus.PENDING;
      
      const scheduledStr = getLocalTimeString(scheduledTime);
      const arrivalStr = getLocalTimeString(arrivalTime);
      
      infraction.description = `Retraso de ${Math.round(delayMinutes)} min en paradero ${routeStop.name || routeStop.id}. Programado: ${scheduledStr}, Real: ${arrivalStr}`;
      
      await this.infractionRepository.save(infraction);

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

  private async recalculateOfflineInfraction(
    ticket: DailyTicketEntity,
    routeStop: RouteStopEntity,
    satTime: Date,
    roundId: string,
    tenantId: string
  ) {
    const startStops = await this.routeStopRepository.find({
      where: { routeId: ticket.routeId as string, type: GeofenceType.START }
    });
    const startGeofenceIds = startStops.map(s => s.traccarGeofenceId);
    if (startGeofenceIds.length === 0) return;

    // Buscar evento de salida de esa vuelta
    const startEvent = await this.trackingEventRepository.findOne({
      where: {
        roundId,
        eventType: 'geofenceEnter' as any,
        traccarGeofenceId: In(startGeofenceIds),
      }
    });

    if (!startEvent) return;

    const scheduledTime = new Date(startEvent.serverTime.getTime() + routeStop.minutesFromStart * 60000);
    const delayMinutes = (satTime.getTime() - scheduledTime.getTime()) / 60000;

    // Buscar si ya existía una infracción preliminar creada por la sincronización de la PWA
    const existingInfraction = await this.infractionRepository.findOne({
      where: {
        dailyTicketId: ticket.id,
        roundId,
        type: InfractionType.RETRASO_RUTA,
        status: InfractionStatus.PENDING
      }
    });

    if (delayMinutes > 2) {
      const scheduledStr = getLocalTimeString(scheduledTime);
      const arrivalStr = getLocalTimeString(satTime);
      const description = `[Rectificado por Satélite] Retraso de ${Math.round(delayMinutes)} min en paradero ${routeStop.name || routeStop.id}. Programado: ${scheduledStr}, Real: ${arrivalStr}`;

      if (existingInfraction) {
        // Actualizar la infracción preliminar con los datos oficiales
        existingInfraction.description = description;
        existingInfraction.amount = 10.00;
        await this.infractionRepository.save(existingInfraction);
      } else {
        // Crear si no existía (por ejemplo, si el sync de la PWA falló pero el satélite reporta la multa)
        const infraction = new InfractionEntity();
        infraction.tenantId = tenantId;
        infraction.vehicleId = ticket.vehicleId;
        infraction.userId = ticket.driverId || '';
        infraction.dailyTicketId = ticket.id;
        infraction.roundId = roundId;
        infraction.type = InfractionType.RETRASO_RUTA;
        infraction.amount = 10.00;
        infraction.status = InfractionStatus.PENDING;
        infraction.description = description;
        await this.infractionRepository.save(infraction);
      }
    } else {
      // Si el satélite demuestra que llegó a tiempo, eliminamos la multa preliminar del front
      if (existingInfraction) {
        await this.infractionRepository.remove(existingInfraction);
      }
    }
  }

  private async autoCompleteRound(
    activeRound: DailyRoundEntity,
    ticket: DailyTicketEntity,
    vehicleId: string,
    arrivalTime: Date
  ): Promise<void> {
    // 1. Completar la vuelta actual
    activeRound.status = RoundsStatus.COMPLETED;
    activeRound.endTime = arrivalTime;
    await this.dailyRoundRepository.save(activeRound);

    // 2. Determinar la dirección de retorno
    const nextDirection = activeRound.direction === 'IDA' ? 'VUELTA' : 'IDA';

    // 3. Crear la siguiente vuelta en PENDING (sala de espera de retorno)
    const nextRound = new DailyRoundEntity();
    nextRound.dailyTicketId = ticket.id;
    nextRound.roundNumber = activeRound.roundNumber + 1;
    nextRound.direction = nextDirection;
    nextRound.status = RoundsStatus.PENDING;
    await this.dailyRoundRepository.save(nextRound);

    // 4. Actualizar la caché satelital en caliente
    await this.vehicleTenantCache.setDailyTicketId(vehicleId, ticket.id);
  }
}
