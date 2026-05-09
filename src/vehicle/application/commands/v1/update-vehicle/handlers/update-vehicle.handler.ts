import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { UpdateVehicleCommand } from '../update-vehicle.command';
import { VehicleRepository } from '@vehicle/domain/repositories/vehicle.repository';
import { VehicleEntity } from '@vehicle/domain/entities/vehicle.entity';
import { AppError } from '@shared/domain/errors/app-errors';
import { AuditService } from '@shared/application/services/audit.service';

@CommandHandler(UpdateVehicleCommand)
export class UpdateVehicleHandler implements ICommandHandler<UpdateVehicleCommand> {
  constructor(
    @Inject('VehicleRepository')
    private readonly vehicleRepository: VehicleRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(command: UpdateVehicleCommand): Promise<Result<VehicleEntity, AppError>> {
    // 1. Verificar si existe
    const vehicleResult = await this.vehicleRepository.findById(command.id);
    if (vehicleResult.isErr()) return err(vehicleResult.error);

    const vehicle = vehicleResult.value;
    
    // Clonamos los valores antiguos para la auditoría
    const oldValues = { ...vehicle };

    // 2. Validar placa si cambió
    if (vehicle.plate !== command.plate) {
      const existing = await this.vehicleRepository.findByPlate(command.plate);
      if (existing.isOk()) return err('ALREADY_EXISTS');
    }

    // 3. Actualizar campos
    vehicle.plate = command.plate;
    vehicle.traccarDeviceId = command.traccarDeviceId ?? null;
    vehicle.brand = command.brand;
    vehicle.model = command.model;
    vehicle.year = command.year;
    vehicle.color = command.color ?? null;

    // 4. Guardar
    const saveResult = await this.vehicleRepository.save(vehicle);

    if (saveResult.isOk()) {
      // 5. Registrar en auditoría
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
