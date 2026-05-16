import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { UpdateVehicleStatusCommand } from '../update-vehicle-status.command';
import { VehicleRepository } from '@vehicle/domain/repositories/vehicle.repository';
import { VehicleEntity, VehicleStatus } from '@vehicle/domain/entities/vehicle.entity';
import { AppError } from '@shared/domain/errors/app-errors';
import { AuditService } from '@shared/application/services/audit.service';

@CommandHandler(UpdateVehicleStatusCommand)
export class UpdateVehicleStatusHandler implements ICommandHandler<UpdateVehicleStatusCommand> {
  constructor(
    @Inject('VehicleRepository')
    private readonly vehicleRepository: VehicleRepository,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Ejecuta la actualización de estado de un vehículo.
   * 
   * @param command - Datos: vehicleId e isActive
   * @returns Result con la entidad actualizada o error si no existe
   */
  async execute(command: UpdateVehicleStatusCommand): Promise<Result<VehicleEntity, AppError>> {
    // 1. Buscar el vehículo
    const vehicleResult = await this.vehicleRepository.findById(command.vehicleId);
    if (vehicleResult.isErr()) {
      return err(vehicleResult.error);
    }

    const vehicle = vehicleResult.value;
    const oldStatus = vehicle.status;

    // 2. Actualizar el estado
    vehicle.status = command.status;

    // 3. Guardar cambios
    const saveResult = await this.vehicleRepository.save(vehicle);
    
    if (saveResult.isOk()) {
      // 4. Registrar en auditoría (sin esperar, proceso en segundo plano)
      this.auditService.createLog({
        tenantId: command.tenantId,
        userId: command.userId,
        action: 'UPDATE_STATUS',
        entityName: 'vehicles',
        entityId: vehicle.id,
        oldValues: { status: oldStatus },
        newValues: { status: vehicle.status },
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
      });
    }

    return saveResult;
  }
}
