import { Controller, Post, Param, UseGuards, PreconditionFailedException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '@shared/infrastructure/guards/jwt-auth.guard';
import { DailyTicketEntity, TicketStatus } from '../../../../domain/entities/daily-ticket.entity';
import { DailyRoundEntity, RoundsStatus } from '../../../../domain/entities/daily-round.entity';
import { InfractionEntity, InfractionStatus } from '../../../../../infraction/domain/entities/infraction.entity';
import { VehicleTenantCache } from '../../../../../monitoring/infrastructure/cache/vehicle-tenant.cache';

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
    private readonly vehicleTenantCache: VehicleTenantCache,
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
}
