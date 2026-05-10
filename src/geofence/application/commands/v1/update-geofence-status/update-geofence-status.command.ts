import { RegisterStatus } from '@shared/domain/enums/register-status.enum';

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
