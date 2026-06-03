import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { CreateVehicleCommand } from '../create-vehicle.command';
import { VehicleRepository } from '@vehicle/domain/repositories/vehicle.repository';
import { VehicleEntity } from '@vehicle/domain/entities/vehicle.entity';
import { AppError } from '@shared/domain/errors/app-errors';
import { AuditService } from '@shared/application/services/audit.service';
import { ITraccarProvider } from '@shared/infrastructure/traccar/traccar-provider.interface';
import { VehicleTenantCache } from '@monitoring/infrastructure/cache/vehicle-tenant.cache';

@CommandHandler(CreateVehicleCommand)
export class CreateVehicleHandler implements ICommandHandler<CreateVehicleCommand> {
  constructor(
    @Inject('VehicleRepository')
    private readonly vehicleRepository: VehicleRepository,
    @Inject('ITraccarProvider')
    private readonly traccarProvider: ITraccarProvider,
    private readonly auditService: AuditService,
    private readonly vehicleTenantCache: VehicleTenantCache,
  ) {}

  async execute(command: CreateVehicleCommand): Promise<Result<VehicleEntity, AppError>> {
    // 1. Validar si la placa ya existe
    const existingResult = await this.vehicleRepository.findByPlate(command.plate);
    if (existingResult.isOk()) {
      return err('ALREADY_EXISTS');
    }

    let traccarId: number | null = null;

    // 2. Registrar el dispositivo en Traccar si se proporcionó un identificador (IMEI / ID App)
    if (command.uniqueId) {
      // 2.1. Verificar que el identificador no exista ya en Traccar
      const existsResult = await this.traccarProvider.checkDeviceExists(command.uniqueId);
      if (existsResult.isErr()) {
        return err('TRACCAR_API_ERROR');
      }
      if (existsResult.value === true) {
        return err('TRACCAR_DEVICE_ALREADY_EXISTS');
      }

      // 2.2. Crear el dispositivo en Traccar
      const traccarResult = await this.traccarProvider.createDevice({
        name: command.plate,
        uniqueId: command.uniqueId,
      });

      if (traccarResult.isErr()) {
        return err('TRACCAR_API_ERROR');
      }

      traccarId = traccarResult.value.id ?? null;
    }

    // 3. Crear nueva entidad
    const newVehicle = new VehicleEntity();
    newVehicle.plate = command.plate;
    newVehicle.traccarDeviceId = command.uniqueId ?? null;
    newVehicle.traccarId = traccarId;
    newVehicle.year = command.year;
    newVehicle.tenantId = command.tenantId;
    newVehicle.passengerCapacity = command.passengerCapacity ?? null;
    newVehicle.ownerName = command.ownerName ?? null;
    newVehicle.ownerPhone = command.ownerPhone ?? null;
    if (command.status) {
      newVehicle.status = command.status as any;
    }

    // 4. Guardar en persistencia
    const saveResult = await this.vehicleRepository.save(newVehicle);

    if (saveResult.isOk()) {
      if (traccarId) {
        this.vehicleTenantCache.setVehicleState(traccarId, {
          vehicleId: saveResult.value.id,
          tenantId: saveResult.value.tenantId,
          dailyTicketId: null,
          plate: saveResult.value.plate,
          driverName: 'No asignado',
          driverId: null,
          routeId: null,
          direction: null,
        });
      }

      this.auditService.createLog({
        tenantId: command.tenantId,
        userId: command.userId,
        action: 'CREATE',
        entityName: 'vehicles',
        entityId: saveResult.value.id,
        newValues: saveResult.value,
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
      });
    }

    return saveResult;
  }
}
