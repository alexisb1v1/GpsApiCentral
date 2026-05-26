import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { DriverNotificationSentEvent } from '../../../domain/events/driver-notification-sent.event';
import { DriverGateway } from '../../../interfaces/ws/driver.gateway';

@EventsHandler(DriverNotificationSentEvent)
export class DriverNotificationSentHandler implements IEventHandler<DriverNotificationSentEvent> {
  constructor(private readonly driverGateway: DriverGateway) {}

  async handle(event: DriverNotificationSentEvent) {
    const { driverId, payload } = event;
    this.driverGateway.emitNotificationToDriver(driverId, {
      ...payload,
      timestamp: payload.timestamp.toISOString(),
    });
  }
}
