import { RegisterStatus } from '@geofence/domain/entities/geofence.entity';

export class UpdateGeofenceStatusCommand {
  constructor(
    public readonly id: string,
    public readonly status: RegisterStatus,
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly ipAddress: string,
    public readonly userAgent: string,
  ) {}
}
