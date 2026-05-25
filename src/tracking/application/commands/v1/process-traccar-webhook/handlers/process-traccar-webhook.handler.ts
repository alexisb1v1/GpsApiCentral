import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ProcessTraccarWebhookCommand } from '../process-traccar-webhook.command';
import { VehicleRepository } from '@vehicle/domain/repositories/vehicle.repository';
import { DailyTicketRepository } from '@daily-ticket/domain/repositories/daily-ticket.repository';
import { DailyTicketEntity } from '@daily-ticket/domain/entities/daily-ticket.entity';
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
  ) {}

  async execute(command: ProcessTraccarWebhookCommand): Promise<void> {
    const { payload } = command;
    const { event, device, position } = payload;

    // 1. Buscar Vehículo por IMEI
    const vehicleResult = await this.vehicleRepository.findByTraccarId(device.uniqueId);
    if (vehicleResult.isErr()) return;
    const vehicle = vehicleResult.value;

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

    // 4. Registrar el Evento de Tracking (La Bitácora)
    const trackingEvent = new TrackingEventEntity();
    trackingEvent.tenantId = vehicle.tenantId;
    trackingEvent.dailyTicketId = ticket.id;
    trackingEvent.traccarGeofenceId = event.geofenceId;
    trackingEvent.eventType = event.type as TrackingEventType;
    trackingEvent.serverTime = new Date(position.fixTime);
    trackingEvent.latitude = position.latitude;
    trackingEvent.longitude = position.longitude;
    await this.trackingEventRepository.save(trackingEvent);

    // 5. Regla de Negocio: Solo procesamos ENTRADAS para penalidades
    if (event.type !== 'geofenceEnter') return;

    // 6. Si es paradero intermedio (CHECKPOINT), verificar retraso
    if (routeStop.type === GeofenceType.CHECKPOINT && ticket.routeId) {
      await this.handleCheckpoint(ticket, routeStop.traccarGeofenceId, ticket.routeId, trackingEvent.serverTime, vehicle.tenantId);
    }
  }

  private async handleCheckpoint(ticket: DailyTicketEntity, traccarGeofenceId: number, routeId: string, arrivalTime: Date, tenantId: string) {
    // A. Buscar el orden y tiempo programado para este paradero en esta ruta
    const routeStop = await this.routeStopRepository.findOne({
      where: { routeId, traccarGeofenceId }
    });
    if (!routeStop) return;

    // B. Buscar paraderos de INICIO (START) de esta ruta
    const startStops = await this.routeStopRepository.find({
      where: { routeId, type: GeofenceType.START }
    });
    const startGeofenceIds = startStops.map(s => s.traccarGeofenceId);
    if (startGeofenceIds.length === 0) return;

    // C. Buscar el evento de INICIO (START) del viaje actual
    // Buscamos el evento START más reciente de hoy para este ticket que coincida con las geocercas START
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const localDateStr = formatter.format(arrivalTime);
    const startOfDayLocal = new Date(`${localDateStr}T00:00:00-05:00`);

    const startEvent = await this.trackingEventRepository.findOne({
      where: {
        dailyTicketId: ticket.id,
        eventType: TrackingEventType.ENTER,
        traccarGeofenceId: In(startGeofenceIds),
        serverTime: MoreThanOrEqual(startOfDayLocal) // Hoy en hora local (America/Lima)
      },
      order: { serverTime: 'DESC' }
    });

    if (!startEvent) return;

    // D. Calcular Hora Programada
    const scheduledTime = new Date(startEvent.serverTime.getTime() + routeStop.minutesFromStart * 60000);

    // E. Comparar (Permitimos 2 minutos de tolerancia por ejemplo, o 0 según rigor)
    const delayMinutes = (arrivalTime.getTime() - scheduledTime.getTime()) / 60000;

    if (delayMinutes > 2) { // Si el retraso es mayor a 2 minutos
      // F. Generar Infracción Automática
      const infraction = new InfractionEntity();
      infraction.tenantId = tenantId;
      infraction.vehicleId = ticket.vehicleId;
      infraction.type = InfractionType.RETRASO_RUTA;
      infraction.amount = 10.00; // Monto base o configurable
      infraction.status = InfractionStatus.PENDING;
      infraction.description = `Retraso de ${Math.round(delayMinutes)} min en paradero ${routeStop.name || routeStop.id}. Programado: ${scheduledTime.toLocaleTimeString('es-PE', { timeZone: 'America/Lima' })}, Real: ${arrivalTime.toLocaleTimeString('es-PE', { timeZone: 'America/Lima' })}`;
      
      await this.infractionRepository.save(infraction);
    }
  }
}
