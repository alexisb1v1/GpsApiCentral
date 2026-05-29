import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { InfractionEntity } from '@infraction/domain/entities/infraction.entity';
import { DailyTicketEntity } from '@daily-ticket/domain/entities/daily-ticket.entity';
import { CreateInfractionController } from '../../interfaces/http/v1/create-infraction/create-infraction.controller';
import { TypeOrmInfractionRepository } from '../persistence/typeorm-infraction.repository';
import { CreateInfractionHandler } from '@infraction/application/commands/v1/create-infraction/handlers/create-infraction.handler';
import { SharedModule } from '@shared/infrastructure/nestjs/shared.module';
import { VehicleModule } from '@vehicle/infrastructure/nestjs/vehicle.module';
import { PaymentModule } from '../../../payment/infrastructure/nestjs/payment.module';
import { PayInfractionController } from '../../interfaces/http/v1/pay-infraction/pay-infraction.controller';
import { PayInfractionHandler } from '@infraction/application/commands/v1/pay-infraction/handlers/pay-infraction.handler';
import { AnnulInfractionController } from '../../interfaces/http/v1/annul-infraction/annul-infraction.controller';
import { AnnulInfractionHandler } from '@infraction/application/commands/v1/annul-infraction/handlers/annul-infraction.handler';
import { GetInfractionsController } from '../../interfaces/http/v1/get-infractions/get-infractions.controller';
import { GetInfractionsHandler } from '@infraction/application/queries/v1/get-infractions/get-infractions.handler';

const Handlers = [CreateInfractionHandler, PayInfractionHandler, AnnulInfractionHandler, GetInfractionsHandler];

const Repositories = [
  {
    provide: 'InfractionRepository',
    useClass: TypeOrmInfractionRepository,
  },
];

@Module({
  imports: [
    TypeOrmModule.forFeature([InfractionEntity, DailyTicketEntity]),
    CqrsModule,
    SharedModule,
    VehicleModule,
    PaymentModule,
  ],
  controllers: [
    CreateInfractionController,
    PayInfractionController,
    AnnulInfractionController,
    GetInfractionsController,
  ],
  providers: [...Repositories, ...Handlers],
  exports: ['InfractionRepository'],
})
export class InfractionModule {}
