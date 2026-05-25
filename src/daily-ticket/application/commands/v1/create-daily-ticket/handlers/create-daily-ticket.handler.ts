import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { CreateDailyTicketCommand } from '../create-daily-ticket.command';
import { DailyTicketRepository } from '@daily-ticket/domain/repositories/daily-ticket.repository';
import { DailyTicketEntity, TicketStatus } from '@daily-ticket/domain/entities/daily-ticket.entity';
import { DailyRoundEntity, RoundsStatus } from '@daily-ticket/domain/entities/daily-round.entity';
import { VehicleRepository } from '@vehicle/domain/repositories/vehicle.repository';
import { AppError } from '@shared/domain/errors/app-errors';
import { AuditService } from '@shared/application/services/audit.service';
import { VehicleTenantCache } from '../../../../../../monitoring/infrastructure/cache/vehicle-tenant.cache';

@CommandHandler(CreateDailyTicketCommand)
export class CreateDailyTicketHandler implements ICommandHandler<CreateDailyTicketCommand> {
  constructor(
    @Inject('DailyTicketRepository')
    private readonly dailyTicketRepository: DailyTicketRepository,
    @Inject('VehicleRepository')
    private readonly vehicleRepository: VehicleRepository,
    private readonly auditService: AuditService,
    private readonly vehicleTenantCache: VehicleTenantCache,
  ) { }

  async execute(command: CreateDailyTicketCommand): Promise<Result<DailyTicketEntity, AppError>> {
    // 1. Validar que el vehículo existe y pertenece al tenant
    const vehicleResult = await this.vehicleRepository.findById(command.vehicleId);
    if (vehicleResult.isErr()) return err(vehicleResult.error);

    const vehicle = vehicleResult.value;
    if (vehicle.tenantId !== command.tenantId) {
      return err('FORBIDDEN');
    }

    // 2. Determinar la fecha de trabajo (default hoy)
    const workDate = command.workDate || new Date().toISOString().split('T')[0];

    // 3. Verificar si ya existe un ticket para ese día
    const existingTicketResult = await this.dailyTicketRepository.findByVehicleAndDate(command.vehicleId, workDate);
    if (existingTicketResult.isOk() && existingTicketResult.value) {
      return err('ALREADY_EXISTS');
    }

    // 4. Crear la entidad
    const ticket = new DailyTicketEntity();
    ticket.tenantId = command.tenantId;
    ticket.vehicleId = command.vehicleId;
    ticket.registeredBy = command.userId;
    ticket.driverId = command.driverId;
    ticket.routeId = command.routeId;
    ticket.totalAmount = command.totalAmount;
    ticket.adminFee = command.adminFee;
    ticket.routeFee = command.routeFee;
    ticket.status = TicketStatus.ACTIVE;
    ticket.paymentMethod = command.paymentMethod || 'EFECTIVO';
    ticket.paymentReference = command.paymentReference || null;

    // 5. Guardar
    const saveResult = await this.dailyTicketRepository.save(ticket);
    if (saveResult.isErr()) return err(saveResult.error);

    const savedTicket = saveResult.value;

    // 5.0 Crear y guardar la vuelta inicial en daily_rounds
    const round = new DailyRoundEntity();
    round.dailyTicketId = savedTicket.id;
    round.roundNumber = 1;
    round.direction = command.direction || 'IDA';
    round.status = RoundsStatus.IN_PROGRESS;

    const roundSaveResult = await this.dailyTicketRepository.saveRound(round);
    if (roundSaveResult.isErr()) {
      console.error('Error al guardar la vuelta inicial en daily_rounds:', roundSaveResult.error);
    }

    // 5.1 Sincronizar en caliente la caché en memoria para monitoreo en tiempo real
    this.vehicleTenantCache.setDailyTicketId(savedTicket.vehicleId, savedTicket.id);

    // 6. Registrar en auditoría
    this.auditService.createLog({
      tenantId: command.tenantId,
      userId: command.userId,
      action: 'CREATE_DAILY_TICKET',
      entityName: 'daily_tickets',
      entityId: savedTicket.id,
      newValues: savedTicket,
      ipAddress: command.ipAddress,
      userAgent: command.userAgent,
    });

    return ok(savedTicket);
  }
}
