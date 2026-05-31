import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ProcessTraccarWebhookCommand } from '../process-traccar-webhook.command';
import { randomUUID } from 'crypto';
import { DriverNotificationSentEvent } from '../../../../../../monitoring/domain/events/driver-notification-sent.event';
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
  ) {}

  async execute(command: ProcessTraccarWebhookCommand): Promise<void> {
    const { payload } = command;
    const { event, device, position } = payload;

    // 1. Buscar Vehículo por traccarId (ID numérico que envía Traccar en event.deviceId / device.id)
    const vehicle = await this.vehicleTypeOrmRepository.findOne({
      where: { traccarId: event.deviceId }
    });
    if (!vehicle) return;

    // 2. Buscar Paradero directamente en route_stops usando el traccarGeofenceId
    const routeStop = await this.routeStopRepository.findOne({
      where: { traccarGeofenceId: event.geofenceId }
    });
    if (!routeStop) return;

    // 3. Buscar Ticket Diario Activo (para saber la Ruta) en la zona horaria local (America/Lima / Pucallpa)
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const today = formatter.format(new Date(position.fixTime));
    const ticketResult = await this.dailyTicketRepository.findActiveByVehicle(vehicle.id, today);
    if (ticketResult.isErr() || !ticketResult.value) return;
    const ticket = ticketResult.value;

    // 3.1. Obtener el round (vuelta) activa actual de este ticket en Postgres
    const activeRound = await this.dailyRoundRepository.findOne({
      where: { dailyTicketId: ticket.id, status: 'IN_PROGRESS' as any }
    });
    const roundId = activeRound ? activeRound.id : null;

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

    // 6. Si es paradero intermedio (CHECKPOINT), verificar retraso
    if (routeStop.type === GeofenceType.CHECKPOINT && ticket.routeId && roundId) {
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
      
      const scheduledStr = scheduledTime.toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' });
      const arrivalStr = arrivalTime.toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' });
      
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
            },
          }),
        );
      }
    }
  }
}
