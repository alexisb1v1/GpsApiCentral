import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ProcessTraccarWebhookCommand } from '../process-traccar-webhook.command';
import { VehicleRepository } from '@vehicle/domain/repositories/vehicle.repository';
import { GeofenceRepository } from '@geofence/domain/repositories/geofence.repository';
import { DailyTicketRepository } from '@daily-ticket/domain/repositories/daily-ticket.repository';
import { TrackingEventEntity, TrackingEventType } from '@tracking/domain/entities/tracking-event.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { GeofenceType } from '@geofence/domain/entities/geofence.entity';
import { RouteStopEntity } from '@route/domain/entities/route-stop.entity';
import { InfractionEntity, InfractionType, InfractionStatus } from '@infraction/domain/entities/infraction.entity';

@CommandHandler(ProcessTraccarWebhookCommand)
export class ProcessTraccarWebhookHandler implements ICommandHandler<ProcessTraccarWebhookCommand> {
  constructor(
    @Inject('VehicleRepository')
    private readonly vehicleRepository: VehicleRepository,
    @Inject('GeofenceRepository')
    private readonly geofenceRepository: GeofenceRepository,
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

    // 2. Buscar Geocerca por Traccar ID
    const geofenceResult = await this.geofenceRepository.findByTraccarId(vehicle.tenantId, event.geofenceId);
    if (geofenceResult.isErr() || !geofenceResult.value) return;
    const geofence = geofenceResult.value;

    // 3. Buscar Ticket Diario Activo (para saber la Ruta)
    const today = new Date(position.fixTime).toISOString().split('T')[0];
    const ticketResult = await this.dailyTicketRepository.findActiveByVehicle(vehicle.id, today);
    if (ticketResult.isErr() || !ticketResult.value) return;
    const ticket = ticketResult.value;

    // 4. Registrar el Evento de Tracking (La Bitácora)
    const trackingEvent = new TrackingEventEntity();
    trackingEvent.tenantId = vehicle.tenantId;
    trackingEvent.vehicleId = vehicle.id;
    trackingEvent.geofenceId = geofence.id;
    trackingEvent.eventType = event.type as TrackingEventType;
    trackingEvent.fixTime = new Date(position.fixTime);
    trackingEvent.latitude = position.latitude;
    trackingEvent.longitude = position.longitude;
    await this.trackingEventRepository.save(trackingEvent);

    // 5. Regla de Negocio: Solo procesamos ENTRADAS para penalidades
    if (event.type !== 'geofenceEnter') return;

    // 6. Si es paradero intermedio (CHECKPOINT), verificar retraso
    if (geofence.type === GeofenceType.CHECKPOINT && ticket.routeId) {
      await this.handleCheckpoint(vehicle.id, geofence.id, ticket.routeId, trackingEvent.fixTime, vehicle.tenantId);
    }
  }

  private async handleCheckpoint(vehicleId: string, geofenceId: string, routeId: string, arrivalTime: Date, tenantId: string) {
    // A. Buscar el orden y tiempo programado para este paradero en esta ruta
    const routeStop = await this.routeStopRepository.findOne({
      where: { routeId, geofenceId }
    });
    if (!routeStop) return;

    // B. Buscar el evento de INICIO (START) del viaje actual
    // Buscamos el evento START más reciente de hoy para este vehículo
    const startEvent = await this.trackingEventRepository.findOne({
      where: {
        vehicleId,
        eventType: TrackingEventType.ENTER,
        geofence: { type: GeofenceType.START },
        fixTime: MoreThanOrEqual(new Date(arrivalTime.toISOString().split('T')[0])) // Hoy
      },
      order: { fixTime: 'DESC' },
      relations: ['geofence']
    });

    if (!startEvent) return;

    // C. Calcular Hora Programada
    const scheduledTime = new Date(startEvent.fixTime.getTime() + routeStop.minutesFromStart * 60000);

    // D. Comparar (Permitimos 2 minutos de tolerancia por ejemplo, o 0 según rigor)
    const delayMinutes = (arrivalTime.getTime() - scheduledTime.getTime()) / 60000;

    if (delayMinutes > 2) { // Si el retraso es mayor a 2 minutos
      // E. Generar Infracción Automática
      const infraction = new InfractionEntity();
      infraction.tenantId = tenantId;
      infraction.vehicleId = vehicleId;
      infraction.type = InfractionType.RETRASO_RUTA;
      infraction.amount = 10.00; // Monto base o configurable
      infraction.status = InfractionStatus.PENDING;
      infraction.description = `Retraso de ${Math.round(delayMinutes)} min en paradero ${routeStop.id}. Programado: ${scheduledTime.toLocaleTimeString()}, Real: ${arrivalTime.toLocaleTimeString()}`;
      
      await this.infractionRepository.save(infraction);
    }
  }
}
