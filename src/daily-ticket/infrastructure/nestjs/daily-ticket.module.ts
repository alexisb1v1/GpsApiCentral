import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyTicketEntity } from '../../domain/entities/daily-ticket.entity';
import { DailyRoundEntity } from '../../domain/entities/daily-round.entity';
import { TypeOrmDailyTicketRepository } from '../persistence/typeorm-daily-ticket.repository';
import { CreateDailyTicketController } from '../../interfaces/http/v1/create-daily-ticket/create-daily-ticket.controller';
import { GetDailyTicketsController } from '../../interfaces/http/v1/get-daily-tickets/get-daily-tickets.controller';
import { DailyTicketOperationsController } from '../../interfaces/http/v1/operations/daily-ticket-operations.controller';
import { CreateDailyTicketHandler } from '../../application/commands/v1/create-daily-ticket/handlers/create-daily-ticket.handler';
import { GetDailyTicketsHandler } from '../../application/queries/v1/get-daily-tickets/handlers/get-daily-tickets.handler';
import { VehicleModule } from '@vehicle/infrastructure/nestjs/vehicle.module';
import { MonitoringModule } from '../../../monitoring/monitoring.module';
import { PaymentModule } from '../../../payment/infrastructure/nestjs/payment.module';
import { DriverModule } from '@driver/infrastructure/nestjs/driver.module';
import { RouteModule } from '../../../route/infrastructure/nestjs/route.module';
import { UserModule } from '@user/infrastructure/nestjs/user.module';
import { TraccarModule } from '@shared/infrastructure/traccar/traccar.module';
import { InfractionEntity } from '../../../infraction/domain/entities/infraction.entity';
import { TrackingEventEntity } from '../../../tracking/domain/entities/tracking-event.entity';
import { RouteStopEntity } from '../../../route/domain/entities/route-stop.entity';

const CommandHandlers = [CreateDailyTicketHandler];
const QueryHandlers = [GetDailyTicketsHandler];

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([DailyTicketEntity, DailyRoundEntity, InfractionEntity, TrackingEventEntity, RouteStopEntity]),
    forwardRef(() => VehicleModule),
    PaymentModule,
    DriverModule,
    RouteModule,
    UserModule,
    forwardRef(() => MonitoringModule),
    TraccarModule,
  ],
  controllers: [
    CreateDailyTicketController, 
    GetDailyTicketsController,
    DailyTicketOperationsController
  ],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    {
      provide: 'DailyTicketRepository',
      useClass: TypeOrmDailyTicketRepository,
    },
  ],
  exports: ['DailyTicketRepository'],
})
export class DailyTicketModule {}
