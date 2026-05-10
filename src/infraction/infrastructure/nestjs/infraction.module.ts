import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { InfractionEntity } from '@infraction/domain/entities/infraction.entity';
import { CreateInfractionController } from '../../interfaces/http/v1/create-infraction/create-infraction.controller';
import { TypeOrmInfractionRepository } from '../persistence/typeorm-infraction.repository';
import { CreateInfractionHandler } from '@infraction/application/commands/v1/create-infraction/handlers/create-infraction.handler';
import { SharedModule } from '@shared/infrastructure/nestjs/shared.module';
import { VehicleModule } from '@vehicle/infrastructure/nestjs/vehicle.module';
import { PayInfractionController } from '../../interfaces/http/v1/pay-infraction/pay-infraction.controller';
import { PayInfractionHandler } from '@infraction/application/commands/v1/pay-infraction/handlers/pay-infraction.handler';
import { AnnulInfractionController } from '../../interfaces/http/v1/annul-infraction/annul-infraction.controller';
import { AnnulInfractionHandler } from '@infraction/application/commands/v1/annul-infraction/handlers/annul-infraction.handler';

const Handlers = [CreateInfractionHandler, PayInfractionHandler, AnnulInfractionHandler];

const Repositories = [
  {
    provide: 'InfractionRepository',
    useClass: TypeOrmInfractionRepository,
  },
];

@Module({
  imports: [
    TypeOrmModule.forFeature([InfractionEntity]),
    CqrsModule,
    SharedModule,
    VehicleModule,
  ],
  controllers: [
    CreateInfractionController,
    PayInfractionController,
    AnnulInfractionController,
  ],
  providers: [...Repositories, ...Handlers],
  exports: ['InfractionRepository'],
})
export class InfractionModule {}
