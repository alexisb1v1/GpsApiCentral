import { ICommand } from '@nestjs/cqrs';

export class UpdateDriverCommand implements ICommand {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly licenseNumber: string,
    public readonly licenseExpiry: Date,
    public readonly dni: string,
    public readonly phoneEmergency?: string,
    public readonly status?: string,
    public readonly userId?: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
  ) {}
}
