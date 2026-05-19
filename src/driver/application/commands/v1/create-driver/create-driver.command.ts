import { ICommand } from '@nestjs/cqrs';

export class CreateDriverCommand implements ICommand {
  constructor(
    public readonly tenantId: string,
    public readonly name: string,
    public readonly licenseNumber: string,
    public readonly licenseExpiry: Date,
    public readonly dni: string,
    public readonly phoneEmergency?: string,
    public readonly userId?: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
  ) {}
}
