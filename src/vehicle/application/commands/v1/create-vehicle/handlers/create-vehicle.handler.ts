import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { CreateVehicleCommand } from '../create-vehicle.command';
import { VehicleRepository } from '@vehicle/domain/repositories/vehicle.repository';
import { VehicleEntity } from '@vehicle/domain/entities/vehicle.entity';
import { AppError } from '@shared/domain/errors/app-errors';
import { AuditService } from '@shared/application/services/audit.service';

@CommandHandler(CreateVehicleCommand)
export class CreateVehicleHandler implements ICommandHandler<CreateVehicleCommand> {
  constructor(
    @Inject('VehicleRepository')
    private readonly vehicleRepository: VehicleRepository,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Ejecuta el registro de un nuevo vehículo.
   * 
   * @param command - Datos del vehículo (placa, marca, modelo, año, tenantId, color)
   * @returns Result con la entidad creada o error si la placa ya existe
   */
  async execute(command: CreateVehicleCommand): Promise<Result<VehicleEntity, AppError>> {
    // 1. Validar si la placa ya existe
    const existingResult = await this.vehicleRepository.findByPlate(command.plate);
    if (existingResult.isOk()) {
      return err('ALREADY_EXISTS');
    }

    // 2. Crear nueva entidad
    const newVehicle = new VehicleEntity();
    newVehicle.plate = command.plate;
    newVehicle.traccarDeviceId = command.traccarDeviceId ?? null;
    newVehicle.brand = command.brand;
    newVehicle.model = command.model;
    newVehicle.year = command.year;
    newVehicle.tenantId = command.tenantId;
    newVehicle.color = command.color ?? null;
    newVehicle.isActive = true;

    // 3. Guardar en persistencia
    const saveResult = await this.vehicleRepository.save(newVehicle);

    if (saveResult.isOk()) {
      // 4. Registrar en auditoría
      const vehicle = saveResult.value;
      this.auditService.createLog({
        tenantId: command.tenantId,
        userId: command.userId,
        action: 'CREATE',
        entityName: 'vehicles',
        entityId: vehicle.id,
        newValues: vehicle,
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
      });
    }

    return saveResult;
  }
}
