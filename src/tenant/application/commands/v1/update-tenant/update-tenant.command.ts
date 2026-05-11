export class UpdateTenantCommand {
  constructor(
    public readonly id: string,
    public readonly name?: string,
    public readonly subdomain?: string,
    public readonly isActive?: boolean,
    public readonly logoUrl?: string,
    public readonly primaryColor?: string,
    public readonly accentColor?: string,
    public readonly statusDotColor?: string,
    public readonly userId?: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
  ) {}
}
