import { VehicleStatus } from '@vehicle/domain/entities/vehicle.entity';

export class UpdateVehicleStatusCommand {
  constructor(
    public readonly vehicleId: string,
    public readonly status: VehicleStatus,
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
  ) {}
}
