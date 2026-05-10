import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { CreateInfractionCommand } from '../create-infraction.command';
import { InfractionRepository } from '@infraction/domain/repositories/infraction.repository';
import { InfractionEntity, InfractionStatus } from '@infraction/domain/entities/infraction.entity';
import { VehicleRepository } from '@vehicle/domain/repositories/vehicle.repository';
import { AppError } from '@shared/domain/errors/app-errors';
import { AuditService } from '@shared/application/services/audit.service';

@CommandHandler(CreateInfractionCommand)
export class CreateInfractionHandler implements ICommandHandler<CreateInfractionCommand> {
  constructor(
    @Inject('InfractionRepository')
    private readonly infractionRepository: InfractionRepository,
    @Inject('VehicleRepository')
    private readonly vehicleRepository: VehicleRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(command: CreateInfractionCommand): Promise<Result<InfractionEntity, AppError>> {
    // 1. Validar que el vehículo existe y pertenece al tenant
    const vehicleResult = await this.vehicleRepository.findById(command.vehicleId);
    if (vehicleResult.isErr()) return err(vehicleResult.error);
    
    const vehicle = vehicleResult.value;
    if (vehicle.tenantId !== command.tenantId) {
      return err('FORBIDDEN' as any); // O un error más específico de dominio
    }

    // 2. Crear la entidad
    const infraction = new InfractionEntity();
    infraction.tenantId = command.tenantId;
    infraction.vehicleId = command.vehicleId;
    infraction.userId = command.userId;
    infraction.type = command.type;
    infraction.amount = command.amount;
    infraction.status = InfractionStatus.PENDING;
    infraction.description = command.description;

    // 3. Guardar
    const saveResult = await this.infractionRepository.save(infraction);
    if (saveResult.isErr()) return err(saveResult.error);

    const savedInfraction = saveResult.value;

    // 4. Registrar en auditoría
    this.auditService.createLog({
      tenantId: command.tenantId,
      userId: command.userId,
      action: 'CREATE_INFRACTION',
      entityName: 'infractions',
      entityId: savedInfraction.id,
      newValues: savedInfraction,
      ipAddress: command.ipAddress,
      userAgent: command.userAgent,
    });

    return ok(savedInfraction);
  }
}
