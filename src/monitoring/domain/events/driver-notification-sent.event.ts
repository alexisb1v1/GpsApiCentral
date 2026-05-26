import { IEvent } from '@nestjs/cqrs';

export class DriverNotificationSentEvent implements IEvent {
  constructor(
    public readonly driverId: string,
    public readonly payload: {
      id: string;
      type: 'INFRACTION' | 'CHECKPOINT_MARKED' | 'NEXT_CHECKPOINT' | 'SYSTEM';
      title: string;
      message: string;
      timestamp: Date;
      data?: any;
    }
  ) {}
}
