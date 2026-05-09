import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { AnnulInfractionCommand } from '../annul-infraction.command';
import { InfractionRepository } from '../../../../domain/repositories/infraction.repository';
import { InfractionStatus } from '../../../../domain/entities/infraction.entity';
import { AppError } from '@shared/domain/errors/app-errors';
import { AuditService } from '@shared/application/services/audit.service';

@CommandHandler(AnnulInfractionCommand)
export class AnnulInfractionHandler implements ICommandHandler<AnnulInfractionCommand> {
  constructor(
    @Inject('InfractionRepository')
    private readonly infractionRepository: InfractionRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(command: AnnulInfractionCommand): Promise<Result<boolean, AppError>> {
    // 1. Buscar la infracción
    const infractionResult = await this.infractionRepository.findById(command.infractionId);
    if (infractionResult.isErr()) return err(infractionResult.error);

    const infraction = infractionResult.value;

    // 2. Validar pertenencia al tenant
    if (infraction.tenantId !== command.tenantId) {
      return err({
        code: 'FORBIDDEN',
        message: 'No tienes permiso para anular esta infracción',
      } as AppError);
    }

    // 3. Validar estado (solo se pueden anular si no están ya anuladas o pagadas)
    // El usuario podría querer anular una pagada (proceso de devolución), pero usualmente es solo PENDING.
    // Vamos a permitir anular PENDING por ahora.
    if (infraction.status === InfractionStatus.ANNULLED) {
      return err({
        code: 'BAD_REQUEST',
        message: 'La infracción ya se encuentra anulada',
      } as AppError);
    }

    // 4. Clonar estado anterior para auditoría
    const oldValues = { ...infraction };

    // 5. Actualizar estado y motivo
    infraction.status = InfractionStatus.ANNULLED;
    infraction.cancellationReason = command.reason;

    // 6. Guardar cambios
    const saveResult = await this.infractionRepository.save(infraction);
    if (saveResult.isErr()) return err(saveResult.error);

    // 7. Registrar en auditoría
    this.auditService.createLog({
      tenantId: command.tenantId,
      userId: command.userId,
      action: 'ANNUL_INFRACTION',
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
