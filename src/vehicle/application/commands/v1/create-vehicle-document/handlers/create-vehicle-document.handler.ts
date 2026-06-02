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
    // 1. Buscar si ya existen documentos para este vehículo
    const docsResult = await this.repository.findByVehicleId(command.vehicleId);
    let document: VehicleDocumentEntity;
    let action: 'CREATE' | 'UPDATE' = 'CREATE';

    if (docsResult.isOk()) {
      // 2. Filtrar por el tipo de documento para ver si ya está registrado
      const existingDoc = docsResult.value.find(
        (doc) => doc.documentType === command.documentType,
      );

      if (existingDoc) {
        document = existingDoc;
        action = 'UPDATE';
      } else {
        document = new VehicleDocumentEntity();
      }
    } else {
      document = new VehicleDocumentEntity();
    }

    // 3. Asignar/actualizar campos
    document.vehicleId = command.vehicleId;
    document.tenantId = command.tenantId;
    document.documentType = command.documentType;
    document.documentNumber = command.documentNumber;
    document.expirationDate = command.expirationDate ? new Date(command.expirationDate) : null;
    document.notifyExpiration = command.notifyExpiration;

    // 4. Guardar
    const saveResult = await this.repository.save(document);

    if (saveResult.isOk()) {
      const saved = saveResult.value;
      this.auditService.createLog({
        tenantId: command.tenantId,
        userId: command.userId,
        action: action,
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
