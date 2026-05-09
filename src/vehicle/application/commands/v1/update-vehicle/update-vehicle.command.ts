export class UpdateVehicleCommand {
  constructor(
    public readonly id: string,
    public readonly plate: string,
    public readonly traccarDeviceId: string | null,
    public readonly brand: string,
    public readonly model: string,
    public readonly year: number,
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly color?: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
  ) {}
}
