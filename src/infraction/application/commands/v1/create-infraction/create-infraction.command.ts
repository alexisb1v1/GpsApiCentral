import { InfractionType } from '@infraction/domain/entities/infraction.entity';

export class CreateInfractionCommand {
  constructor(
    public readonly tenantId: string,
    public readonly vehicleId: string,
    public readonly userId: string,
    public readonly type: InfractionType,
    public readonly amount: number,
    public readonly description: string | null,
    public readonly ipAddress: string,
    public readonly userAgent: string,
  ) {}
}
