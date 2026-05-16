import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { DeleteVehicleDocumentCommand } from '../delete-vehicle-document.command';
import { VehicleDocumentRepository } from '@vehicle/domain/repositories/vehicle-document.repository';
import { AppError } from '@shared/domain/errors/app-errors';
import { AuditService } from '@shared/application/services/audit.service';

@CommandHandler(DeleteVehicleDocumentCommand)
export class DeleteVehicleDocumentHandler implements ICommandHandler<DeleteVehicleDocumentCommand> {
  constructor(
    @Inject('VehicleDocumentRepository')
    private readonly repository: VehicleDocumentRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(command: DeleteVehicleDocumentCommand): Promise<Result<void, AppError>> {
    const docResult = await this.repository.findById(command.id);
    if (docResult.isErr()) return err(docResult.error);
    
    const document = docResult.value;

    const result = await this.repository.delete(command.id);

    if (result.isOk()) {
      this.auditService.createLog({
        tenantId: command.tenantId,
        userId: command.userId,
        action: 'DELETE',
        entityName: 'vehicle_documents',
        entityId: command.id,
        oldValues: document,
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
      });
    }

    return result;
  }
}
