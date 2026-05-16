export class CreateVehicleDocumentCommand {
  constructor(
    public readonly vehicleId: string,
    public readonly tenantId: string,
    public readonly documentType: string,
    public readonly documentNumber: string,
    public readonly expirationDate: string | null,
    public readonly notifyExpiration: boolean,
    public readonly userId: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
  ) {}
}
