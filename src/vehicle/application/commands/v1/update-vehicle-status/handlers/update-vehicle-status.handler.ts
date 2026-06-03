import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { UpdateVehicleStatusCommand } from '../update-vehicle-status.command';
import { VehicleRepository } from '@vehicle/domain/repositories/vehicle.repository';
import { VehicleEntity, VehicleStatus } from '@vehicle/domain/entities/vehicle.entity';
import { AppError } from '@shared/domain/errors/app-errors';
import { AuditService } from '@shared/application/services/audit.service';
import { ITraccarProvider } from '@shared/infrastructure/traccar/traccar-provider.interface';
import { VehicleTenantCache } from '@monitoring/infrastructure/cache/vehicle-tenant.cache';

@CommandHandler(UpdateVehicleStatusCommand)
export class UpdateVehicleStatusHandler implements ICommandHandler<UpdateVehicleStatusCommand> {
  constructor(
    @Inject('VehicleRepository')
    private readonly vehicleRepository: VehicleRepository,
    @Inject('ITraccarProvider')
    private readonly traccarProvider: ITraccarProvider,
    private readonly auditService: AuditService,
    private readonly vehicleTenantCache: VehicleTenantCache,
  ) {}

  /**
   * Ejecuta la actualización de estado de un vehículo.
   */
  async execute(command: UpdateVehicleStatusCommand): Promise<Result<VehicleEntity, AppError>> {
    // 1. Buscar el vehículo
    const vehicleResult = await this.vehicleRepository.findById(command.vehicleId);
    if (vehicleResult.isErr()) {
      return err(vehicleResult.error);
    }

    const vehicle = vehicleResult.value;
    const oldStatus = vehicle.status;
    const oldTraccarId = vehicle.traccarId;

    // 2. Actualizar el estado
    vehicle.status = command.status;

    // 3. Gestionar Traccar si pasa a BAJA o si se reactiva desde BAJA
    if (command.status === VehicleStatus.BAJA && oldStatus !== VehicleStatus.BAJA) {
      // Si se da de baja, desafiliar en Traccar y en caché
      vehicle.traccarId = null;
      vehicle.traccarDeviceId = null;
      if (oldTraccarId) {
        this.vehicleTenantCache.removeVehicleState(oldTraccarId, vehicle.id);
        await this.traccarProvider.deleteDevice(oldTraccarId);
      }
    } else if ((command.status === VehicleStatus.OPERATIVO || command.status === VehicleStatus.TALLER) && oldStatus === VehicleStatus.BAJA) {
      // Si se reactiva desde BAJA, volver a registrar en Traccar si tiene IMEI
      if (vehicle.traccarDeviceId) {
        const existsResult = await this.traccarProvider.checkDeviceExists(vehicle.traccarDeviceId);
        if (existsResult.isOk() && existsResult.value === false) {
          const traccarResult = await this.traccarProvider.createDevice({
            name: vehicle.plate,
            uniqueId: vehicle.traccarDeviceId,
          });
          if (traccarResult.isOk()) {
            vehicle.traccarId = traccarResult.value.id ?? null;
          }
        }
      }
    }

    // 4. Guardar cambios
    const saveResult = await this.vehicleRepository.save(vehicle);
    
    if (saveResult.isOk()) {
      const savedVehicle = saveResult.value;
      
      // Sincronizar en caliente la caché si está activo y tiene traccarId
      if (savedVehicle.status !== VehicleStatus.BAJA && savedVehicle.traccarId) {
        this.vehicleTenantCache.setVehicleState(savedVehicle.traccarId, {
          vehicleId: savedVehicle.id,
          tenantId: savedVehicle.tenantId,
          dailyTicketId: null,
          plate: savedVehicle.plate,
          driverName: 'No asignado',
          driverId: null,
          routeId: null,
          direction: null,
        });
      }

      // 5. Registrar en auditoría
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
