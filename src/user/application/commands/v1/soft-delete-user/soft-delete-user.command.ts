export class SoftDeleteUserCommand {
  constructor(
    public readonly id: string,
    public readonly tenantId?: string,
    public readonly userId?: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
  ) {}
}
