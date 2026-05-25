import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { UpdateVehicleCommand } from '../update-vehicle.command';
import { VehicleRepository } from '@vehicle/domain/repositories/vehicle.repository';
import { VehicleEntity } from '@vehicle/domain/entities/vehicle.entity';
import { AppError } from '@shared/domain/errors/app-errors';
import { AuditService } from '@shared/application/services/audit.service';
import { ITraccarProvider } from '@shared/infrastructure/traccar/traccar-provider.interface';

@CommandHandler(UpdateVehicleCommand)
export class UpdateVehicleHandler implements ICommandHandler<UpdateVehicleCommand> {
  constructor(
    @Inject('VehicleRepository')
    private readonly vehicleRepository: VehicleRepository,
    @Inject('ITraccarProvider')
    private readonly traccarProvider: ITraccarProvider,
    private readonly auditService: AuditService,
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

    // 3. Gestión del identificador (IMEI) en Traccar solo si cambió
    const newTraccarId = command.traccarDeviceId ?? null;
    let traccarId = vehicle.traccarId;

    if (newTraccarId !== vehicle.traccarDeviceId) {
      if (newTraccarId) {
        // 3.1. Verificar si ya existe en Traccar
        const existsResult = await this.traccarProvider.checkDeviceExists(newTraccarId);
        if (existsResult.isErr()) {
          return err('TRACCAR_API_ERROR');
        }
        if (existsResult.value === true) {
          return err('TRACCAR_DEVICE_ALREADY_EXISTS');
        }

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
