export class SoftDeleteTenantCommand {
  constructor(
    public readonly id: string,
    public readonly userId?: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
  ) {}
}
