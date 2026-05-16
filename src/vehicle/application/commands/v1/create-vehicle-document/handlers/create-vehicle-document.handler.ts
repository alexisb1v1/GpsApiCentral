import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { CreateVehicleDocumentCommand } from '../create-vehicle-document.command';
import { VehicleDocumentRepository } from '@vehicle/domain/repositories/vehicle-document.repository';
import { VehicleDocumentEntity } from '@vehicle/domain/entities/vehicle-document.entity';
import { AppError } from '@shared/domain/errors/app-errors';
import { AuditService } from '@shared/application/services/audit.service';

@CommandHandler(CreateVehicleDocumentCommand)
export class CreateVehicleDocumentHandler implements ICommandHandler<CreateVehicleDocumentCommand> {
  constructor(
    @Inject('VehicleDocumentRepository')
    private readonly repository: VehicleDocumentRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(command: CreateVehicleDocumentCommand): Promise<Result<VehicleDocumentEntity, AppError>> {
    const document = new VehicleDocumentEntity();
    document.vehicleId = command.vehicleId;
    document.tenantId = command.tenantId;
    document.documentType = command.documentType;
    document.documentNumber = command.documentNumber;
    document.expirationDate = command.expirationDate ? new Date(command.expirationDate) : null;
    document.notifyExpiration = command.notifyExpiration;

    const saveResult = await this.repository.save(document);

    if (saveResult.isOk()) {
      const saved = saveResult.value;
      this.auditService.createLog({
        tenantId: command.tenantId,
        userId: command.userId,
        action: 'CREATE',
        entityName: 'vehicle_documents',
        entityId: saved.id,
        newValues: saved,
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
      });
    }

    return saveResult;
  }
}
