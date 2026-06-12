import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { BullModule } from '@nestjs/bullmq';
import { TrackingEventEntity } from '../../domain/entities/tracking-event.entity';
import { DailyRoundEntity } from '@daily-ticket/domain/entities/daily-round.entity';
import { DailyTicketEntity } from '@daily-ticket/domain/entities/daily-ticket.entity';
import { VehicleEntity } from '@vehicle/domain/entities/vehicle.entity';
import { TenantEntity } from '@tenant/domain/entities/tenant.entity';
import { TraccarWebhookController } from '../../interfaces/http/v1/traccar-webhook/traccar-webhook.controller';
import { ProcessTraccarWebhookHandler } from '../../application/commands/v1/process-traccar-webhook/handlers/process-traccar-webhook.handler';
import { ConciliateOfflineEventsHandler } from '../../application/commands/v1/conciliate-offline-events/handlers/conciliate-offline-events.handler';
import { AuditRoundHandler } from '../../application/commands/v1/audit-round/handlers/audit-round.handler';
import { RoundCompletedHandler } from '../../application/events/handlers/round-completed.handler';
import { RoundAuditProcessor } from '../queue/processors/round-audit.processor';
import { VehicleModule } from '@vehicle/infrastructure/nestjs/vehicle.module';
import { DailyTicketModule } from '@daily-ticket/infrastructure/nestjs/daily-ticket.module';
import { RouteStopEntity } from '@route/domain/entities/route-stop.entity';
import { InfractionEntity } from '@infraction/domain/entities/infraction.entity';
import { MonitoringModule } from '../../../monitoring/monitoring.module';
import { TraccarModule } from '../../../shared/infrastructure/traccar/traccar.module';

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([
      TrackingEventEntity, 
      RouteStopEntity, 
      InfractionEntity, 
      DailyRoundEntity,
      DailyTicketEntity,
      VehicleEntity,
      TenantEntity,
    ]),
    BullModule.registerQueue({
      name: 'audit-round-queue',
    }),
    VehicleModule,
    DailyTicketModule,
    MonitoringModule,
    TraccarModule,
  ],
  controllers: [TraccarWebhookController],
  providers: [
    ProcessTraccarWebhookHandler, 
    ConciliateOfflineEventsHandler,
    AuditRoundHandler,
    RoundCompletedHandler,
    RoundAuditProcessor,
  ],
  exports: [TypeOrmModule, BullModule],
})
export class TrackingModule {}
