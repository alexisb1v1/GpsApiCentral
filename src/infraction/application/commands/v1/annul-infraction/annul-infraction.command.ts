export class AnnulInfractionCommand {
  constructor(
    public readonly infractionId: string,
    public readonly reason: string,
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
  ) {}
}
