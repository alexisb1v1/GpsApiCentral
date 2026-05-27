import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateDailyTicketCommand } from '../create-daily-ticket.command';
import { DailyTicketRepository } from '@daily-ticket/domain/repositories/daily-ticket.repository';
import { DailyTicketEntity, TicketStatus } from '@daily-ticket/domain/entities/daily-ticket.entity';
import { DailyRoundEntity, RoundsStatus } from '@daily-ticket/domain/entities/daily-round.entity';
import { VehicleRepository } from '@vehicle/domain/repositories/vehicle.repository';
import { AppError } from '@shared/domain/errors/app-errors';
import { AuditService } from '@shared/application/services/audit.service';
import { VehicleTenantCache } from '../../../../../../monitoring/infrastructure/cache/vehicle-tenant.cache';
import { DocumentSequenceEntity } from '@shared/domain/entities/document-sequence.entity';
import { PaymentEntity } from '../../../../../../payment/domain/entities/payment.entity';

@CommandHandler(CreateDailyTicketCommand)
export class CreateDailyTicketHandler implements ICommandHandler<CreateDailyTicketCommand> {
  constructor(
    private readonly dataSource: DataSource,
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

    // 4. Iniciar transacción manual para control de secuencias y pessimistic locking
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // A. Bloquear y leer la secuencia correlativa para este tenant: SELECT ... FOR UPDATE
      const sequence = await queryRunner.manager.createQueryBuilder(DocumentSequenceEntity, 'seq')
        .setLock('pessimistic_write') // FOR UPDATE
        .where('seq.tenantId = :tenantId AND seq.documentType = :docType', {
          tenantId: command.tenantId,
          docType: 'DAILY_TICKET',
        })
        .getOne();

      if (!sequence) {
        throw new Error('SEQUENCE_NOT_FOUND');
      }

      // B. Incrementar y generar el número de ticket formateado
      const nextValue = sequence.currentValue + 1;
      const prefix = sequence.prefix || '';
      const paddedNumber = String(nextValue).padStart(6, '0');
      const ticketNumber = `${prefix}${paddedNumber}`;

      // C. Crear e insertar el ticket diario
      const ticket = new DailyTicketEntity();
      ticket.tenantId = command.tenantId;
      ticket.vehicleId = command.vehicleId;
      ticket.ticketNumber = ticketNumber;
      ticket.registeredBy = command.userId;
      ticket.driverId = command.driverId;
      ticket.routeId = command.routeId;
      ticket.totalAmount = command.totalAmount;
      ticket.adminFee = command.adminFee;
      ticket.routeFee = command.routeFee;
      ticket.status = TicketStatus.ACTIVE;
      ticket.workDate = workDate as any;

      const savedTicket = await queryRunner.manager.save(ticket);

      // D. Crear e guardar la vuelta inicial en daily_rounds
      const round = new DailyRoundEntity();
      round.dailyTicketId = savedTicket.id;
      round.roundNumber = 1;
      round.direction = command.direction || 'IDA';
      round.status = RoundsStatus.IN_PROGRESS;

      await queryRunner.manager.save(round);

      // E. Crear e guardar el pago en la nueva tabla payments
      const payment = new PaymentEntity();
      payment.tenantId = command.tenantId;
      payment.dailyTicketId = savedTicket.id;
      payment.infractionId = null;
      payment.amount = savedTicket.totalAmount;
      payment.paymentMethod = command.paymentMethod || 'EFECTIVO';
      payment.operationReference = command.paymentReference || null;
      payment.registeredBy = command.userId;

      await queryRunner.manager.save(payment);

      // F. Actualizar el contador de secuencia en la base de datos
      sequence.currentValue = nextValue;
      await queryRunner.manager.save(sequence);

      // G. Hacer commit de la transacción
      await queryRunner.commitTransaction();

      // H. Operaciones posteriores no bloqueantes
      this.vehicleTenantCache.setDailyTicketId(savedTicket.vehicleId, savedTicket.id);

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
    } catch (error: any) {
      // Rollback en caso de cualquier error para no dejar estados inconsistentes
      await queryRunner.rollbackTransaction();
      console.error('Error transaccional al crear ticket diario:', error);
      if (error.message === 'SEQUENCE_NOT_FOUND') {
        return err('NOT_FOUND');
      }
      return err('INTERNAL_ERROR');
    } finally {
      // Liberar query runner
      await queryRunner.release();
    }
  }
}
