import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { UpdateVehicleCommand } from '../update-vehicle.command';
import { VehicleRepository } from '@vehicle/domain/repositories/vehicle.repository';
import { VehicleEntity, VehicleStatus } from '@vehicle/domain/entities/vehicle.entity';
import { AppError } from '@shared/domain/errors/app-errors';
import { AuditService } from '@shared/application/services/audit.service';
import { ITraccarProvider } from '@shared/infrastructure/traccar/traccar-provider.interface';
import { VehicleTenantCache } from '@monitoring/infrastructure/cache/vehicle-tenant.cache';

@CommandHandler(UpdateVehicleCommand)
export class UpdateVehicleHandler implements ICommandHandler<UpdateVehicleCommand> {
  constructor(
    @Inject('VehicleRepository')
    private readonly vehicleRepository: VehicleRepository,
    @Inject('ITraccarProvider')
    private readonly traccarProvider: ITraccarProvider,
    private readonly auditService: AuditService,
    private readonly vehicleTenantCache: VehicleTenantCache,
  ) {}

  async execute(command: UpdateVehicleCommand): Promise<Result<VehicleEntity, AppError>> {
    // 1. Verificar si el vehículo existe
    const vehicleResult = await this.vehicleRepository.findById(command.id);
    if (vehicleResult.isErr()) return err(vehicleResult.error);

    const vehicle = vehicleResult.value;
    const oldValues = { ...vehicle };

    // 2. Validar placa si cambió
    if (vehicle.plate !== command.plate) {
      const existing = await this.vehicleRepository.findByPlate(command.plate);
      if (existing.isOk()) return err('ALREADY_EXISTS');
    }

    // 3. Gestión del identificador (IMEI) en Traccar solo si cambió o si se reactiva desde BAJA
    const newTraccarId = command.traccarDeviceId ?? null;
    let traccarId = vehicle.traccarId;
    const isReactivating = oldValues.status === VehicleStatus.BAJA && 
      (command.status === VehicleStatus.OPERATIVO || command.status === VehicleStatus.TALLER);

    // Si se pasa a BAJA, forzar la desafiliación y eliminación de Traccar
    if (command.status === VehicleStatus.BAJA && oldValues.status !== VehicleStatus.BAJA) {
      traccarId = null;
      vehicle.traccarDeviceId = null;
      if (oldValues.traccarId) {
        await this.vehicleTenantCache.removeVehicleState(oldValues.traccarId, vehicle.id);
        await this.traccarProvider.deleteDevice(oldValues.traccarId);
      }
    } else if (newTraccarId !== vehicle.traccarDeviceId || (isReactivating && newTraccarId)) {
      if (newTraccarId) {
        // 3.1. Verificar si ya existe en Traccar
        const existsResult = await this.traccarProvider.checkDeviceExists(newTraccarId);
        if (existsResult.isErr()) {
          return err('TRACCAR_API_ERROR');
        }
        
        if (existsResult.value === true && !isReactivating) {
          return err('TRACCAR_DEVICE_ALREADY_EXISTS');
        }

        if (existsResult.value === false) {
          // 3.2. No existe → crearlo en Traccar
          const traccarResult = await this.traccarProvider.createDevice({
            name: command.plate,
            uniqueId: newTraccarId,
          });
          if (traccarResult.isErr()) {
            return err('TRACCAR_API_ERROR');
          }

          traccarId = traccarResult.value.id ?? null;
        } else {
          // Si ya existía y es reactivación, y teníamos el traccarId guardado, lo preservamos
          traccarId = oldValues.traccarId;
        }
      } else {
        traccarId = null;
      }
    }

    // 4. Actualizar campos
    vehicle.plate = command.plate;
    vehicle.traccarDeviceId = newTraccarId;
    vehicle.traccarId = traccarId;
    vehicle.year = command.year;
    vehicle.passengerCapacity = command.passengerCapacity ?? null;
    vehicle.ownerName = command.ownerName ?? null;
    vehicle.ownerPhone = command.ownerPhone ?? null;
    if (command.status) {
      vehicle.status = command.status as any;
    }

    // 5. Guardar
    const saveResult = await this.vehicleRepository.save(vehicle);

    if (saveResult.isOk()) {
      // Si el traccarId anterior era diferente, remover la clave vieja de la caché
      if (oldValues.traccarId && oldValues.traccarId !== vehicle.traccarId) {
        await this.vehicleTenantCache.removeVehicleState(oldValues.traccarId, oldValues.id);
      }

      if (vehicle.traccarId) {
        // Preservar estado del ticket o chofer si ya existía en la caché
        let currentTicketId: string | null = null;
        let currentDriverName = 'No asignado';
        let currentDriverId: string | null = null;
        let currentRouteId: string | null = null;
        let currentDirection: 'IDA' | 'VUELTA' | null = null;

        const existingState = await this.vehicleTenantCache.getVehicleState(vehicle.traccarId);
        if (existingState) {
          currentTicketId = existingState.dailyTicketId;
          currentDriverName = existingState.driverName || 'No asignado';
          currentDriverId = existingState.driverId;
          currentRouteId = existingState.routeId;
          currentDirection = existingState.direction;
        }

        await this.vehicleTenantCache.setVehicleState(vehicle.traccarId, {
          vehicleId: vehicle.id,
          tenantId: vehicle.tenantId,
          dailyTicketId: currentTicketId,
          plate: vehicle.plate,
          driverName: currentDriverName,
          driverId: currentDriverId,
          routeId: currentRouteId,
          direction: currentDirection,
        });
      }

      this.auditService.createLog({
        tenantId: command.tenantId,
        userId: command.userId,
        action: 'UPDATE',
        entityName: 'vehicles',
        entityId: vehicle.id,
        oldValues: oldValues,
        newValues: vehicle,
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
      });
    }

    return saveResult;
  }
}
