import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, err, ok } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { DeleteVehicleCommand } from '../delete-vehicle.command';
import { VehicleRepository } from '@vehicle/domain/repositories/vehicle.repository';
import { VehicleStatus } from '@vehicle/domain/entities/vehicle.entity';
import { AppError } from '@shared/domain/errors/app-errors';
import { AuditService } from '@shared/application/services/audit.service';

@CommandHandler(DeleteVehicleCommand)
export class DeleteVehicleHandler implements ICommandHandler<DeleteVehicleCommand> {
  constructor(
    @Inject('VehicleRepository')
    private readonly vehicleRepository: VehicleRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(command: DeleteVehicleCommand): Promise<Result<void, AppError>> {
    // 1. Buscar si existe
    const result = await this.vehicleRepository.findById(command.id);
    if (result.isErr()) return err(result.error);

    const vehicle = result.value;
    const oldValues = { ...vehicle };

    // 2. Eliminación lógica (Estado BAJA)
    vehicle.status = VehicleStatus.BAJA;

    // 3. Guardar
    const saveResult = await this.vehicleRepository.save(vehicle);
    
    if (saveResult.isOk()) {
      // 4. Registrar en auditoría
      this.auditService.createLog({
        tenantId: command.tenantId,
        userId: command.userId,
        action: 'DELETE',
        entityName: 'vehicles',
        entityId: vehicle.id,
        oldValues: oldValues,
        newValues: { status: vehicle.status },
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
      });
      return ok(undefined);
    }

    return err(saveResult.error);
  }
}
