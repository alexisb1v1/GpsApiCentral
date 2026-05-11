export class CreateDailyTicketCommand {
  constructor(
    public readonly tenantId: string,
    public readonly vehicleId: string,
    public readonly userId: string,
    public readonly driverId: string | null,
    public readonly routeId: string | null,
    public readonly totalAmount: number,
    public readonly adminFee: number,
    public readonly routeFee: number,
    public readonly workDate: string | null, // Formato YYYY-MM-DD
    public readonly ipAddress: string,
    public readonly userAgent: string,
  ) {}
}
