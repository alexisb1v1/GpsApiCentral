import { CqrsModule } from '@nestjs/cqrs';
import { TrackingEventEntity } from '../../domain/entities/tracking-event.entity';
import { TraccarWebhookController } from '../../interfaces/http/v1/traccar-webhook/traccar-webhook.controller';
import { ProcessTraccarWebhookHandler } from '../../application/commands/v1/process-traccar-webhook/handlers/process-traccar-webhook.handler';
import { VehicleModule } from '@vehicle/infrastructure/nestjs/vehicle.module';
import { GeofenceModule } from '@geofence/infrastructure/nestjs/geofence.module';
import { DailyTicketModule } from '@daily-ticket/infrastructure/nestjs/daily-ticket.module';
import { RouteStopEntity } from '@route/domain/entities/route-stop.entity';
import { InfractionEntity } from '@infraction/domain/entities/infraction.entity';

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([TrackingEventEntity, RouteStopEntity, InfractionEntity]),
    VehicleModule,
    GeofenceModule,
    DailyTicketModule,
  ],
  controllers: [TraccarWebhookController],
  providers: [ProcessTraccarWebhookHandler],
  exports: [TypeOrmModule],
})
export class TrackingModule {}
