export class CreateVehicleCommand {
  constructor(
    public readonly plate: string,
    public readonly uniqueId: string | null, // IMEI o ID de la App GPS
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
