export class UpdateVehicleCommand {
  constructor(
    public readonly id: string,
    public readonly plate: string,
    public readonly traccarDeviceId: number | null,

    public readonly year: number,
    public readonly tenantId: string,
    public readonly userId: string,

    public readonly passengerCapacity?: number,
    public readonly ownerName?: string,
    public readonly ownerPhone?: string,
    public readonly status?: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
  ) {}
}
