import { GeofenceType } from '../../../../domain/entities/geofence.entity';

export class CreateGeofenceCommand {
  constructor(
    public readonly tenantId: string,
    public readonly traccarGeofenceId: number,
    public readonly name: string,
    public readonly type: GeofenceType,
    public readonly userId: string,
    public readonly ipAddress: string,
    public readonly userAgent: string,
  ) {}
}
