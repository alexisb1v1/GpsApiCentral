import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { VehicleEntity } from '@vehicle/domain/entities/vehicle.entity';
import { TypeOrmVehicleRepository } from '@vehicle/infrastructure/persistence/typeorm-vehicle.repository';

// Commands
import { CreateVehicleHandler } from '@vehicle/application/commands/v1/create-vehicle/handlers/create-vehicle.handler';
import { UpdateVehicleStatusHandler } from '@vehicle/application/commands/v1/update-vehicle-status/handlers/update-vehicle-status.handler';
import { UpdateVehicleHandler } from '@vehicle/application/commands/v1/update-vehicle/handlers/update-vehicle.handler';
import { DeleteVehicleHandler } from '@vehicle/application/commands/v1/delete-vehicle/handlers/delete-vehicle.handler';

// Queries
import { GetVehicleByIdHandler } from '@vehicle/application/queries/v1/get-vehicle-by-id/handlers/get-vehicle-by-id.handler';
import { GetVehiclesListHandler } from '@vehicle/application/queries/v1/get-vehicles-list/handlers/get-vehicles-list.handler';

// Controllers
import { CreateVehicleController } from '@vehicle/interfaces/http/v1/create-vehicle/create-vehicle.controller';
import { UpdateVehicleStatusController } from '@vehicle/interfaces/http/v1/update-vehicle-status/update-vehicle-status.controller';
import { UpdateVehicleController } from '@vehicle/interfaces/http/v1/update-vehicle/update-vehicle.controller';
import { DeleteVehicleController } from '@vehicle/interfaces/http/v1/delete-vehicle/delete-vehicle.controller';
import { GetVehicleByIdController } from '@vehicle/interfaces/http/v1/get-vehicle-by-id/get-vehicle-by-id.controller';
import { GetVehiclesListController } from '@vehicle/interfaces/http/v1/get-vehicles-list/get-vehicles-list.controller';

const Handlers = [
  CreateVehicleHandler,
  UpdateVehicleStatusHandler,
  UpdateVehicleHandler,
  DeleteVehicleHandler,
  GetVehicleByIdHandler,
  GetVehiclesListHandler,
];

const Repositories = [
  {
    provide: 'VehicleRepository',
    useClass: TypeOrmVehicleRepository,
  },
];

@Module({
  imports: [
    TypeOrmModule.forFeature([VehicleEntity]),
    CqrsModule,
  ],
  controllers: [
    CreateVehicleController,
    UpdateVehicleStatusController,
    UpdateVehicleController,
    DeleteVehicleController,
    GetVehicleByIdController,
    GetVehiclesListController,
  ],
  providers: [
    ...Repositories,
    ...Handlers,
  ],
  exports: ['VehicleRepository'],
})
export class VehicleModule {}
