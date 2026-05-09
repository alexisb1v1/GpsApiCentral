export class UpdateUserCommand {
  constructor(
    public readonly id: string,
    public readonly name?: string,
    public readonly email?: string,
    public readonly role?: string,
    public readonly isActive?: boolean,
    public readonly tenantId?: string,
    public readonly userId?: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
  ) {}
}
