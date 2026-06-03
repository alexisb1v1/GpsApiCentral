import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PayInfractionCommand } from '../pay-infraction.command';
import { InfractionRepository } from '@infraction/domain/repositories/infraction.repository';
import { InfractionEntity, InfractionStatus } from '@infraction/domain/entities/infraction.entity';
import { AppError } from '@shared/domain/errors/app-errors';
import { AuditService } from '@shared/application/services/audit.service';
import { PaymentEntity } from '@payment/domain/entities/payment.entity';
import { DocumentSequenceEntity } from '@shared/domain/entities/document-sequence.entity';
import { DocumentTypeConstants } from '@shared/domain/constants/document-type.constants';

@CommandHandler(PayInfractionCommand)
export class PayInfractionHandler implements ICommandHandler<PayInfractionCommand> {
  constructor(
    private readonly dataSource: DataSource,
    @Inject('InfractionRepository')
    private readonly infractionRepository: InfractionRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(command: PayInfractionCommand): Promise<Result<boolean, AppError>> {
    // 1. Buscar la infracción (fuera de la transacción para reducir el tiempo de bloqueo de recursos)
    const infractionResult = await this.infractionRepository.findById(command.infractionId);
    if (infractionResult.isErr()) return err(infractionResult.error);

    const infraction = infractionResult.value;

    // 2. Validar pertenencia al tenant
    if (infraction.tenantId !== command.tenantId) {
      return err('FORBIDDEN');
    }

    // 3. Validar estado (solo se pueden pagar las PENDING)
    if (infraction.status === InfractionStatus.PAID) {
      return err('INVALID_INPUT');
    }

    const oldValues = { ...infraction };

    // 4. Iniciar transacción manual para control de secuencias y pessimistic locking
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // A. Bloquear y leer la secuencia de pago (PAYMENT_RECEIPT) con autoinicialización defensiva
      let paymentSequence = await queryRunner.manager.createQueryBuilder(DocumentSequenceEntity, 'seq')
        .setLock('pessimistic_write') // FOR UPDATE
        .where('seq.tenantId = :tenantId AND seq.documentType = :docType', {
          tenantId: command.tenantId,
          docType: DocumentTypeConstants.PAYMENT_RECEIPT,
        })
        .getOne();

      if (!paymentSequence) {
        // Inicializar dinámicamente si no existe en la base de datos
        paymentSequence = new DocumentSequenceEntity();
        paymentSequence.tenantId = command.tenantId;
        paymentSequence.documentType = DocumentTypeConstants.PAYMENT_RECEIPT;
        paymentSequence.currentValue = 0;
        paymentSequence.prefix = 'PAG-';
        await queryRunner.manager.save(paymentSequence);

        // Bloquearla nuevamente
        paymentSequence = await queryRunner.manager.createQueryBuilder(DocumentSequenceEntity, 'seq')
          .setLock('pessimistic_write')
          .where('seq.tenantId = :tenantId AND seq.documentType = :docType', {
            tenantId: command.tenantId,
            docType: DocumentTypeConstants.PAYMENT_RECEIPT,
          })
          .getOne();
      }

      if (!paymentSequence) {
        throw new Error('SEQUENCE_NOT_FOUND');
      }

      // B. Incrementar y generar el número de pago formateado
      const nextPaymentValue = paymentSequence.currentValue + 1;
      const paymentPrefix = paymentSequence.prefix || 'PAG-';
      const paddedPaymentNumber = String(nextPaymentValue).padStart(6, '0');
      const paymentNumber = `${paymentPrefix}${paddedPaymentNumber}`;

      // C. Crear e insertar el pago en la tabla payments
      const payment = new PaymentEntity();
      payment.tenantId = infraction.tenantId;
      payment.dailyTicketId = infraction.dailyTicketId;
      payment.amount = infraction.amount;
      payment.paymentMethod = 'EFECTIVO'; // Método por defecto
      payment.operationReference = command.paymentId || null;
      payment.registeredBy = command.userId;
      payment.paymentNumber = paymentNumber;

      const savedPayment = await queryRunner.manager.save(PaymentEntity, payment);

      // D. Actualizar estado y enlace de pago de la infracción en la base de datos
      infraction.status = InfractionStatus.PAID;
      infraction.paymentId = savedPayment.id;
      await queryRunner.manager.save(InfractionEntity, infraction);

      // E. Actualizar el contador de secuencia de pago
      paymentSequence.currentValue = nextPaymentValue;
      await queryRunner.manager.save(paymentSequence);

      // F. Hacer commit de la transacción
      await queryRunner.commitTransaction();

      // 5. Registrar en auditoría
      this.auditService.createLog({
        tenantId: command.tenantId,
        userId: command.userId,
        action: 'PAY_INFRACTION',
        entityName: 'infractions',
        entityId: infraction.id,
        oldValues: oldValues,
        newValues: infraction,
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
      });

      return ok(true);
    } catch (error: any) {
      // Rollback en caso de cualquier error
      await queryRunner.rollbackTransaction();
      console.error('Error transaccional al pagar infracción:', error);
      return err('INTERNAL_ERROR');
    } finally {
      // Liberar query runner
      await queryRunner.release();
    }
  }
}
