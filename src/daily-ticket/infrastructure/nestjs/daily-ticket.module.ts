import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyTicketEntity } from '../../domain/entities/daily-ticket.entity';
import { DailyRoundEntity } from '../../domain/entities/daily-round.entity';
import { TypeOrmDailyTicketRepository } from '../persistence/typeorm-daily-ticket.repository';
import { CreateDailyTicketController } from '../../interfaces/http/v1/create-daily-ticket/create-daily-ticket.controller';
import { CreateDailyTicketHandler } from '../../application/commands/v1/create-daily-ticket/handlers/create-daily-ticket.handler';
import { VehicleModule } from '@vehicle/infrastructure/nestjs/vehicle.module';

const CommandHandlers = [CreateDailyTicketHandler];

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([DailyTicketEntity, DailyRoundEntity]),
    VehicleModule,
  ],
  controllers: [CreateDailyTicketController],
  providers: [
    ...CommandHandlers,
    {
      provide: 'DailyTicketRepository',
      useClass: TypeOrmDailyTicketRepository,
    },
  ],
  exports: ['DailyTicketRepository'],
})
export class DailyTicketModule {}
