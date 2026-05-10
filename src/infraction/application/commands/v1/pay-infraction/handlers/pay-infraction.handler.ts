import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { PayInfractionCommand } from '../pay-infraction.command';
import { InfractionRepository } from '@infraction/domain/repositories/infraction.repository';
import { InfractionStatus } from '@infraction/domain/entities/infraction.entity';
import { AppError } from '@shared/domain/errors/app-errors';
import { AuditService } from '@shared/application/services/audit.service';

@CommandHandler(PayInfractionCommand)
export class PayInfractionHandler implements ICommandHandler<PayInfractionCommand> {
  constructor(
    @Inject('InfractionRepository')
    private readonly infractionRepository: InfractionRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(command: PayInfractionCommand): Promise<Result<boolean, AppError>> {
    // 1. Buscar la infracción
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

    // 4. Clonar estado anterior para auditoría
    const oldValues = { ...infraction };

    // 5. Actualizar estado
    infraction.status = InfractionStatus.PAID;
    infraction.paymentId = command.paymentId || null;

    // 6. Guardar cambios
    const saveResult = await this.infractionRepository.save(infraction);
    if (saveResult.isErr()) return err(saveResult.error);

    // 7. Registrar en auditoría
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
  }
}
