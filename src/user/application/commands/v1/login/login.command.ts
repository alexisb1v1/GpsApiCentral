export class LoginCommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
    public readonly tenant: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
  ) {}
}
