import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { RoundCompletedEvent } from '../../../domain/events/round-completed.event';

@EventsHandler(RoundCompletedEvent)
export class RoundCompletedHandler implements IEventHandler<RoundCompletedEvent> {
  private readonly logger = new Logger(RoundCompletedHandler.name);

  constructor(
    @InjectQueue('audit-round-queue')
    private readonly auditRoundQueue: Queue,
  ) {}

  async handle(event: RoundCompletedEvent): Promise<void> {
    const { roundId } = event;
    this.logger.log(`Encolando auditoría de doble check para la vuelta ID: ${roundId} con 1 min de delay.`);

    await this.auditRoundQueue.add(
      'audit-round-job',
      { roundId },
      {
        delay: 60000, // 1 minuto de delay para esperar que se complete el envío de posiciones satelitales
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 30000, // 30 segundos, 1 min, 2 min, etc.
        },
        removeOnComplete: true,
        removeOnFail: false, // mantener en caso de error definitivo para análisis/depuración
      },
    );
  }
}
