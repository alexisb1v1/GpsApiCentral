import { IEvent } from '@nestjs/cqrs';

export class RoundCompletedEvent implements IEvent {
  constructor(
    public readonly roundId: string,
  ) {}
}
