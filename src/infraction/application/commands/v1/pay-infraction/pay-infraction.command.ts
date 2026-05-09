export class PayInfractionCommand {
  constructor(
    public readonly infractionId: string,
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly paymentId?: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
  ) {}
}
