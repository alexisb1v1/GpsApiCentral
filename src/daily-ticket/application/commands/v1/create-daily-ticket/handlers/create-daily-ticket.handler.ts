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
import { DocumentTypeConstants } from '@shared/domain/constants/document-type.constants';
import { DriverInfoRepository } from '@driver/domain/repositories/driver-info.repository';
import { RouteRepository } from '../../../../../../route/domain/repositories/route.repository';
import { UserRepository } from '@user/domain/repositories/user.repository';

@CommandHandler(CreateDailyTicketCommand)
export class CreateDailyTicketHandler implements ICommandHandler<CreateDailyTicketCommand> {
  constructor(
    private readonly dataSource: DataSource,
    @Inject('DailyTicketRepository')
    private readonly dailyTicketRepository: DailyTicketRepository,
    @Inject('VehicleRepository')
    private readonly vehicleRepository: VehicleRepository,
    @Inject('DriverInfoRepository')
    private readonly driverInfoRepository: DriverInfoRepository,
    @Inject('RouteRepository')
    private readonly routeRepository: RouteRepository,
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
    private readonly auditService: AuditService,
    private readonly vehicleTenantCache: VehicleTenantCache,
  ) { }

  async execute(command: CreateDailyTicketCommand): Promise<Result<DailyTicketEntity, AppError>> {

    // 1. Validar que el vehículo existe y pertenece al tenant
    const vehicleResult = await this.vehicleRepository.findById(command.vehicleId);
    if (vehicleResult.isErr()) {
      return err('VEHICLE_NOT_FOUND');
    }

    const vehicle = vehicleResult.value;
    if (vehicle.tenantId !== command.tenantId) {
      return err('VEHICLE_TENANT_MISMATCH');
    }

    // 1.1 Validar que el chofer opcional pertenece al mismo tenant
    if (command.driverId) {
      const driverUserResult = await this.userRepository.findById(command.driverId);
      if (driverUserResult.isErr()) {
        return err('DRIVER_NOT_FOUND');
      }
      const driverUser = driverUserResult.value;
      if (driverUser.role !== 'DRIVER') {
        return err('DRIVER_NOT_FOUND');
      }
      if (driverUser.tenantId !== command.tenantId) {
        return err('DRIVER_TENANT_MISMATCH');
      }
    }

    // 1.2 Validar que la ruta opcional pertenece al mismo tenant
    if (command.routeId) {
      const routeResult = await this.routeRepository.findById(command.routeId);
      if (routeResult.isErr()) {
        return err('ROUTE_NOT_FOUND');
      }
      const route = routeResult.value;
      if (route.tenantId !== command.tenantId) {
        return err('ROUTE_TENANT_MISMATCH');
      }
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
          docType: DocumentTypeConstants.DAILY_TICKET,
        })
        .getOne();

      if (!sequence) {
        throw new Error('SEQUENCE_NOT_FOUND');
      }

      // A.1 Bloquear y leer la secuencia de pago (PAYMENT_RECEIPT) con autoinicialización defensiva
      let paymentSequence = await queryRunner.manager.createQueryBuilder(DocumentSequenceEntity, 'seq')
        .setLock('pessimistic_write')
        .where('seq.tenantId = :tenantId AND seq.documentType = :docType', {
          tenantId: command.tenantId,
          docType: DocumentTypeConstants.DAILY_TICKET,
        })
        .getOne();

      if (!paymentSequence) {
        // Inicializar dinámicamente si no existe
        paymentSequence = new DocumentSequenceEntity();
        paymentSequence.tenantId = command.tenantId;
        paymentSequence.documentType = DocumentTypeConstants.DAILY_TICKET;
        paymentSequence.currentValue = 0;
        paymentSequence.prefix = 'TK-';
        await queryRunner.manager.save(paymentSequence);

        paymentSequence = await queryRunner.manager.createQueryBuilder(DocumentSequenceEntity, 'seq')
          .setLock('pessimistic_write')
          .where('seq.tenantId = :tenantId AND seq.documentType = :docType', {
            tenantId: command.tenantId,
            docType: DocumentTypeConstants.DAILY_TICKET,
          })
          .getOne();
      }

      if (!paymentSequence) {
        throw new Error('SEQUENCE_NOT_FOUND');
      }

      // B. Incrementar y generar el número de ticket formateado
      const nextValue = sequence.currentValue + 1;
      const prefix = sequence.prefix || '';
      const paddedNumber = String(nextValue).padStart(6, '0');
      const ticketNumber = `${prefix}${paddedNumber}`;

      // B.1 Incrementar y generar el número de pago formateado
      const nextPaymentValue = paymentSequence.currentValue + 1;
      const paymentPrefix = paymentSequence.prefix || 'TK-';
      const paddedPaymentNumber = String(nextPaymentValue).padStart(6, '0');
      const paymentNumber = `${paymentPrefix}${paddedPaymentNumber}`;

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
      payment.amount = savedTicket.totalAmount;
      payment.paymentMethod = command.paymentMethod || 'EFECTIVO';
      payment.operationReference = command.paymentReference || null;
      payment.registeredBy = command.userId;
      payment.paymentNumber = paymentNumber;

      await queryRunner.manager.save(payment);

      // F. Actualizar los contadores de secuencia en la base de datos
      sequence.currentValue = nextValue;
      await queryRunner.manager.save(sequence);

      paymentSequence.currentValue = nextPaymentValue;
      await queryRunner.manager.save(paymentSequence);

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
