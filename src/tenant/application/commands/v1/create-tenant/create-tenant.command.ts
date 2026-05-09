export class CreateTenantCommand {
  constructor(
    public readonly name: string,
    public readonly subdomain: string,
    public readonly isActive?: boolean,
    public readonly userId?: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
  ) {}
}
