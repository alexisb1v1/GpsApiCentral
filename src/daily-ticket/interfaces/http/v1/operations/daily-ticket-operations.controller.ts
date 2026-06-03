import { Controller, Post, Param, UseGuards, PreconditionFailedException, NotFoundException, Logger, Body } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { JwtAuthGuard } from '@shared/infrastructure/guards/jwt-auth.guard';
import { DailyTicketEntity, TicketStatus } from '../../../../domain/entities/daily-ticket.entity';
import { DailyRoundEntity, RoundsStatus } from '../../../../domain/entities/daily-round.entity';
import { InfractionEntity, InfractionStatus, InfractionType } from '../../../../../infraction/domain/entities/infraction.entity';
import { VehicleTenantCache } from '../../../../../monitoring/infrastructure/cache/vehicle-tenant.cache';
import { TrackingEventEntity } from '../../../../../tracking/domain/entities/tracking-event.entity';
import { RouteStopEntity } from '../../../../../route/domain/entities/route-stop.entity';
import { EventBus } from '@nestjs/cqrs';
import { DriverNotificationSentEvent } from '../../../../../monitoring/domain/events/driver-notification-sent.event';
import { randomUUID } from 'crypto';

export class SyncOfflineCheckpointDto {
  dailyTicketId: string;
  roundId: string;
  traccarGeofenceId: number;
  reachedAt: string;
  latitude: number;
  longitude: number;
}

export class SyncOfflineCheckpointsDto {
  checkpoints: SyncOfflineCheckpointDto[];
}

@Controller('v1/daily-tickets')
@UseGuards(JwtAuthGuard)
export class DailyTicketOperationsController {
  private readonly logger = new Logger(DailyTicketOperationsController.name);

  constructor(
    @InjectRepository(DailyTicketEntity)
    private readonly ticketRepository: Repository<DailyTicketEntity>,
    @InjectRepository(DailyRoundEntity)
    private readonly roundRepository: Repository<DailyRoundEntity>,
    @InjectRepository(InfractionEntity)
    private readonly infractionRepository: Repository<InfractionEntity>,
    @InjectRepository(TrackingEventEntity)
    private readonly trackingEventRepository: Repository<TrackingEventEntity>,
    @InjectRepository(RouteStopEntity)
    private readonly routeStopRepository: Repository<RouteStopEntity>,
    private readonly vehicleTenantCache: VehicleTenantCache,
    private readonly eventBus: EventBus,
  ) {}

  @Post('rounds/:id/start')
  async startRound(@Param('id') roundId: string) {
    const round = await this.roundRepository.findOne({
      where: { id: roundId },
      relations: ['dailyTicket'],
    });

    if (!round) {
      throw new NotFoundException(`Vuelta con ID ${roundId} no encontrada.`);
    }

    if (round.status !== RoundsStatus.PENDING) {
      throw new PreconditionFailedException(`La vuelta no está en estado PENDING (estado actual: ${round.status}).`);
    }

    const ticket = round.dailyTicket;
    if (!ticket || ticket.status !== TicketStatus.ACTIVE) {
      throw new PreconditionFailedException('El ticket diario no está activo o ya fue cerrado.');
    }

    // Regla de Negocio 8: No se puede iniciar ruta si hay sanciones PENDING
    const pendingInfractionsCount = await this.infractionRepository.count({
      where: { dailyTicketId: ticket.id, status: InfractionStatus.PENDING },
    });

    if (pendingInfractionsCount > 0) {
      throw new PreconditionFailedException(
        `No se puede iniciar ruta. El vehículo cuenta con ${pendingInfractionsCount} sanción(es) pendiente(s) de pago.`
      );
    }

    // Iniciar la vuelta
    round.status = RoundsStatus.IN_PROGRESS;
    round.startTime = new Date();
    await this.roundRepository.save(round);

    // Refrescar caché satelital en caliente
    await this.vehicleTenantCache.setDailyTicketId(ticket.vehicleId, ticket.id);

    this.logger.log(`Vuelta ${roundId} iniciada manualmente (IN_PROGRESS). Vehículo: ${ticket.vehicleId}`);

    return {
      success: true,
      message: 'Recorrido iniciado con éxito.',
      data: {
        roundId: round.id,
        status: round.status,
        startTime: round.startTime,
      },
    };
  }

  @Post('rounds/:id/complete')
  async completeRound(@Param('id') roundId: string) {
    const round = await this.roundRepository.findOne({
      where: { id: roundId },
      relations: ['dailyTicket'],
    });

    if (!round) {
      throw new NotFoundException(`Vuelta con ID ${roundId} no encontrada.`);
    }

    if (round.status !== RoundsStatus.IN_PROGRESS) {
      throw new PreconditionFailedException(`La vuelta no está activa en estado IN_PROGRESS (estado actual: ${round.status}).`);
    }

    const ticket = round.dailyTicket;
    if (!ticket) {
      throw new PreconditionFailedException('No se encontró el ticket asociado a esta vuelta.');
    }

    // Completar la vuelta
    round.status = RoundsStatus.COMPLETED;
    round.endTime = new Date();
    await this.roundRepository.save(round);

    // Auto-generar la siguiente vuelta en PENDING
    const nextDirection = round.direction === 'IDA' ? 'VUELTA' : 'IDA';
    const nextRound = new DailyRoundEntity();
    nextRound.dailyTicketId = ticket.id;
    nextRound.roundNumber = round.roundNumber + 1;
    nextRound.direction = nextDirection;
    nextRound.status = RoundsStatus.PENDING;
    await this.roundRepository.save(nextRound);

    // Refrescar caché satelital en caliente
    await this.vehicleTenantCache.setDailyTicketId(ticket.vehicleId, ticket.id);

    this.logger.log(`Vuelta ${roundId} completada manualmente (Contingencia). Siguiente vuelta autogenerada en PENDING.`);

    return {
      success: true,
      message: 'Recorrido completado y retorno programado en sala de espera.',
      data: {
        completedRoundId: round.id,
        nextRoundId: nextRound.id,
        nextDirection: nextRound.direction,
      },
    };
  }

  @Post(':id/close')
  async closeTicket(@Param('id') ticketId: string) {
    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId },
      relations: ['rounds'],
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket diario con ID ${ticketId} no encontrado.`);
    }

    if (ticket.status === TicketStatus.CLOSED) {
      throw new PreconditionFailedException('El ticket ya se encuentra cerrado.');
    }

    // Cerrar el ticket
    ticket.status = TicketStatus.CLOSED;
    await this.ticketRepository.save(ticket);

    // Completar o cancelar cualquier vuelta abierta
    if (ticket.rounds && ticket.rounds.length > 0) {
      const activeRound = ticket.rounds.find(
        (r) => r.status === RoundsStatus.IN_PROGRESS || r.status === RoundsStatus.PENDING
      );
      if (activeRound) {
        activeRound.status = RoundsStatus.COMPLETED;
        activeRound.endTime = new Date();
        await this.roundRepository.save(activeRound);
      }
    }

    // Remover el ticket activo de la caché satelital (estableciéndolo en null)
    await this.vehicleTenantCache.setDailyTicketId(ticket.vehicleId, null);

    this.logger.log(`Jornada laboral del ticket ${ticketId} finalizada con éxito. Vehículo retirado de monitoreo.`);

    return {
      success: true,
      message: 'Jornada laboral finalizada con éxito y vehículo retirado del monitoreo activo.',
    };
  }

  @Post('sync-offline-checkpoints')
  async syncOfflineCheckpoints(@Body() dto: SyncOfflineCheckpointsDto) {
    const { checkpoints } = dto;
    if (!checkpoints || checkpoints.length === 0) {
      return { success: true, message: 'No hay checkpoints para sincronizar.' };
    }

    let synchronizedCount = 0;
    let ignoredCount = 0;

    for (const cp of checkpoints) {
      // 1. Verificar idempotencia: ¿ya existe este ingreso de geocerca para esta vuelta?
      const existing = await this.trackingEventRepository.findOne({
        where: {
          dailyTicketId: cp.dailyTicketId,
          roundId: cp.roundId,
          traccarGeofenceId: cp.traccarGeofenceId,
          eventType: 'geofenceEnter' as any
        }
      });

      if (existing) {
        ignoredCount++;
        continue;
      }

      // 2. Buscar el paradero en route_stops para verificar el tipo
      const routeStop = await this.routeStopRepository.findOne({
        where: { traccarGeofenceId: cp.traccarGeofenceId }
      });

      if (!routeStop) {
        ignoredCount++;
        continue;
      }

      // 3. Buscar el ticket para obtener datos del conductor y tenant
      const ticket = await this.ticketRepository.findOne({
        where: { id: cp.dailyTicketId }
      });

      if (!ticket) {
        ignoredCount++;
        continue;
      }

      // 4. Registrar el Evento en la base de datos (Bitácora)
      const trackingEvent = new TrackingEventEntity();
      trackingEvent.tenantId = ticket.tenantId;
      trackingEvent.dailyTicketId = ticket.id;
      trackingEvent.traccarGeofenceId = cp.traccarGeofenceId;
      trackingEvent.roundId = cp.roundId;
      trackingEvent.eventType = 'geofenceEnter' as any;
      trackingEvent.serverTime = new Date(cp.reachedAt); // la hora en que el conductor cruzó en local
      trackingEvent.latitude = cp.latitude;
      trackingEvent.longitude = cp.longitude;
      trackingEvent.durationSeconds = null;
      trackingEvent.rawPayload = { source: 'frontend-offline-sync' };

      await this.trackingEventRepository.save(trackingEvent);
      synchronizedCount++;

      // 5. Si es paradero de tipo CHECKPOINT, validar el retraso de llegada
      if (routeStop.type === ('CHECKPOINT' as any) && ticket.routeId) {
        await this.handleOfflineCheckpointDelay(
          ticket,
          routeStop,
          trackingEvent.serverTime,
          cp.roundId
        );
      }
    }

    return {
      success: true,
      message: 'Sincronización completada con éxito.',
      data: {
        synchronizedCount,
        ignoredCount,
      }
    };
  }

  private async handleOfflineCheckpointDelay(
    ticket: DailyTicketEntity,
    routeStop: RouteStopEntity,
    arrivalTime: Date,
    roundId: string
  ) {
    // Buscar todas las geocercas tipo START de la ruta
    const startStops = await this.routeStopRepository.find({
      where: { routeId: ticket.routeId as string, type: 'START' as any }
    });
    const startGeofenceIds = startStops.map(s => s.traccarGeofenceId);
    if (startGeofenceIds.length === 0) return;

    // Buscar el evento de salida/entrada inicial de esa vuelta específica
    const startEvent = await this.trackingEventRepository.findOne({
      where: {
        roundId,
        eventType: 'geofenceEnter' as any,
        traccarGeofenceId: In(startGeofenceIds)
      }
    });

    if (!startEvent) return;

    // Calcular hora planificada: hora de inicio de la vuelta + minutos planificados de viaje
    const scheduledTime = new Date(startEvent.serverTime.getTime() + routeStop.minutesFromStart * 60000);
    const delayMinutes = (arrivalTime.getTime() - scheduledTime.getTime()) / 60000;

    if (delayMinutes > 2) {
      // Registrar Infracción
      const infraction = new InfractionEntity();
      infraction.tenantId = ticket.tenantId;
      infraction.vehicleId = ticket.vehicleId;
      infraction.userId = ticket.driverId || '';
      infraction.dailyTicketId = ticket.id;
      infraction.roundId = roundId;
      infraction.type = InfractionType.RETRASO_RUTA;
      infraction.amount = 10.00;
      infraction.status = InfractionStatus.PENDING;

      const scheduledStr = scheduledTime.toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' });
      const arrivalStr = arrivalTime.toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' });

      infraction.description = `[Sincronización local] Retraso de ${Math.round(delayMinutes)} min en paradero ${routeStop.name || routeStop.id}. Programado: ${scheduledStr}, Real: ${arrivalStr}`;

      await this.infractionRepository.save(infraction);

      // Disparar evento reactivo de notificación al conductor
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
          })
        );
      }
    }
  }
}
