export class RefreshTokenCommand {
  constructor(
    public readonly refreshToken: string,
    public readonly deviceFingerprint: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
  ) {}
}
