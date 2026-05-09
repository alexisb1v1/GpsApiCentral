export class CreateRouteCommand {
  constructor(
    public readonly name: string,
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly ipAddress: string,
    public readonly userAgent: string,
  ) {}
}
