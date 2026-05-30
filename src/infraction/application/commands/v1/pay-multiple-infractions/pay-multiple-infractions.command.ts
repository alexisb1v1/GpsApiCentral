export class PayMultipleInfractionsCommand {
  constructor(
    public readonly infractionIds: string[],
    public readonly paymentMethod: string,
    public readonly operationReference: string | undefined,
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
  ) {}
}
