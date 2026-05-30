import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PayMultipleInfractionsCommand } from '../pay-multiple-infractions.command';
import { InfractionRepository } from '@infraction/domain/repositories/infraction.repository';
import { InfractionEntity, InfractionStatus } from '@infraction/domain/entities/infraction.entity';
import { AppError } from '@shared/domain/errors/app-errors';
import { AuditService } from '@shared/application/services/audit.service';
import { PaymentEntity } from '../../../../../../payment/domain/entities/payment.entity';
import { DocumentSequenceEntity } from '@shared/domain/entities/document-sequence.entity';
import { DocumentTypeConstants } from '@shared/domain/constants/document-type.constants';

@CommandHandler(PayMultipleInfractionsCommand)
export class PayMultipleInfractionsHandler implements ICommandHandler<PayMultipleInfractionsCommand> {
  constructor(
    private readonly dataSource: DataSource,
    @Inject('InfractionRepository')
    private readonly infractionRepository: InfractionRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(command: PayMultipleInfractionsCommand): Promise<Result<{ paymentNumber: string; totalAmount: number }, AppError>> {
    // 1. Validar que tengamos IDs en el comando
    if (!command.infractionIds || command.infractionIds.length === 0) {
      return err('INVALID_INPUT');
    }

    // 2. Buscar e indexar las infracciones (fuera de la transacción para reducir el tiempo de bloqueo)
    const infractionPromises = command.infractionIds.map(id => this.infractionRepository.findById(id));
    const results = await Promise.all(infractionPromises);

    const infractions: InfractionEntity[] = [];
    const oldValuesList: any[] = [];
    let totalAmount = 0;

    for (const result of results) {
      if (result.isErr()) {
        return err(result.error);
      }
      const infraction = result.value;

      // Validar pertenencia al tenant
      if (infraction.tenantId !== command.tenantId) {
        return err('FORBIDDEN');
      }

      // Validar estado (solo se pueden pagar las PENDING)
      if (infraction.status !== InfractionStatus.PENDING) {
        return err('INVALID_INPUT');
      }

      oldValuesList.push({ ...infraction });
      // Asegurarnos de que el monto se trate como número decimal
      totalAmount += Number(infraction.amount);
      infractions.push(infraction);
    }

    // 3. Iniciar transacción manual para control de secuencias y pessimistic locking
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

      // C. Crear e insertar el pago consolidado único en la tabla payments
      const payment = new PaymentEntity();
      payment.tenantId = command.tenantId;
      // Usamos el dailyTicketId del primer ticket o null si no aplica
      payment.dailyTicketId = infractions[0]?.dailyTicketId || null;
      payment.amount = totalAmount;
      payment.paymentMethod = command.paymentMethod || 'EFECTIVO';
      payment.operationReference = command.operationReference || null;
      payment.registeredBy = command.userId;
      payment.paymentNumber = paymentNumber;

      const savedPayment = await queryRunner.manager.save(PaymentEntity, payment);

      // D. Actualizar el estado y enlazar el ID del pago en todas las infracciones
      for (const infraction of infractions) {
        infraction.status = InfractionStatus.PAID;
        infraction.paymentId = savedPayment.id;
        await queryRunner.manager.save(InfractionEntity, infraction);
      }

      // E. Actualizar el contador de secuencia de pago
      paymentSequence.currentValue = nextPaymentValue;
      await queryRunner.manager.save(paymentSequence);

      // F. Hacer commit de la transacción
      await queryRunner.commitTransaction();

      // 4. Registrar logs de auditoría individuales para cada infracción pagada
      infractions.forEach((infraction, index) => {
        this.auditService.createLog({
          tenantId: command.tenantId,
          userId: command.userId,
          action: 'PAY_INFRACTION',
          entityName: 'infractions',
          entityId: infraction.id,
          oldValues: oldValuesList[index],
          newValues: infraction,
          ipAddress: command.ipAddress,
          userAgent: command.userAgent,
        });
      });

      // También registramos un log consolidado en la auditoría del pago
      this.auditService.createLog({
        tenantId: command.tenantId,
        userId: command.userId,
        action: 'PAY_MULTIPLE_INFRACTIONS',
        entityName: 'payments',
        entityId: savedPayment.id,
        oldValues: null,
        newValues: {
          paymentId: savedPayment.id,
          paymentNumber,
          totalAmount,
          saldedInfractionsCount: infractions.length,
          infractionIds: command.infractionIds,
        },
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
      });

      return ok({
        paymentNumber,
        totalAmount,
      });
    } catch (error: any) {
      // Rollback en caso de cualquier error transaccional
      await queryRunner.rollbackTransaction();
      console.error('Error transaccional al realizar pago múltiple:', error);
      return err('INTERNAL_ERROR');
    } finally {
      // Liberar query runner
      await queryRunner.release();
    }
  }
}
