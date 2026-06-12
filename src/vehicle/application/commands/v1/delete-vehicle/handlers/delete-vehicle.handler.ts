import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, err, ok } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { DeleteVehicleCommand } from '../delete-vehicle.command';
import { VehicleRepository } from '@vehicle/domain/repositories/vehicle.repository';
import { VehicleStatus } from '@vehicle/domain/entities/vehicle.entity';
import { AppError } from '@shared/domain/errors/app-errors';
import { AuditService } from '@shared/application/services/audit.service';
import { VehicleTenantCache } from '@monitoring/infrastructure/cache/vehicle-tenant.cache';
import { ITraccarProvider } from '@shared/infrastructure/traccar/traccar-provider.interface';

@CommandHandler(DeleteVehicleCommand)
export class DeleteVehicleHandler implements ICommandHandler<DeleteVehicleCommand> {
  constructor(
    @Inject('VehicleRepository')
    private readonly vehicleRepository: VehicleRepository,
    @Inject('ITraccarProvider')
    private readonly traccarProvider: ITraccarProvider,
    private readonly auditService: AuditService,
    private readonly vehicleTenantCache: VehicleTenantCache,
  ) {}

  async execute(command: DeleteVehicleCommand): Promise<Result<void, AppError>> {
    // 1. Buscar si existe
    const result = await this.vehicleRepository.findById(command.id);
    if (result.isErr()) return err(result.error);

    const vehicle = result.value;
    const oldValues = { ...vehicle };

    // 2. Eliminación lógica (Estado BAJA)
    const oldTraccarId = vehicle.traccarId;
    vehicle.status = VehicleStatus.BAJA;
    vehicle.traccarId = null;
    vehicle.traccarDeviceId = null;

    // 3. Guardar
    const saveResult = await this.vehicleRepository.save(vehicle);
    
    if (saveResult.isOk()) {
      if (oldTraccarId) {
        await this.vehicleTenantCache.removeVehicleState(oldTraccarId, vehicle.id);
        // Dar de baja físicamente en Traccar
        await this.traccarProvider.deleteDevice(oldTraccarId);
      }

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
