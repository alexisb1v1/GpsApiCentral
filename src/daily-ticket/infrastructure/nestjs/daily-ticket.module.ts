import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyTicketEntity } from '../../domain/entities/daily-ticket.entity';
import { DailyRoundEntity } from '../../domain/entities/daily-round.entity';
import { TypeOrmDailyTicketRepository } from '../persistence/typeorm-daily-ticket.repository';
import { CreateDailyTicketController } from '../../interfaces/http/v1/create-daily-ticket/create-daily-ticket.controller';
import { GetDailyTicketsController } from '../../interfaces/http/v1/get-daily-tickets/get-daily-tickets.controller';
import { CreateDailyTicketHandler } from '../../application/commands/v1/create-daily-ticket/handlers/create-daily-ticket.handler';
import { GetDailyTicketsHandler } from '../../application/queries/v1/get-daily-tickets/handlers/get-daily-tickets.handler';
import { VehicleModule } from '@vehicle/infrastructure/nestjs/vehicle.module';
import { MonitoringModule } from '../../../monitoring/monitoring.module';

const CommandHandlers = [CreateDailyTicketHandler];
const QueryHandlers = [GetDailyTicketsHandler];

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([DailyTicketEntity, DailyRoundEntity]),
    VehicleModule,
    forwardRef(() => MonitoringModule),
  ],
  controllers: [CreateDailyTicketController, GetDailyTicketsController],
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
