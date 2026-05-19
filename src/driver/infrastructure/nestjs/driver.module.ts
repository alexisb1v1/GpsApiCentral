import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { DriverInfoEntity } from '@driver/domain/entities/driver-info.entity';
import { TypeOrmDriverInfoRepository } from '@driver/infrastructure/persistence/typeorm-driver-info.repository';
import { UserModule } from '@user/infrastructure/nestjs/user.module';
import { TenantModule } from '@tenant/infrastructure/nestjs/tenant.module';

// Commands
import { CreateDriverHandler } from '@driver/application/commands/v1/create-driver/handlers/create-driver.handler';
import { UpdateDriverHandler } from '@driver/application/commands/v1/update-driver/handlers/update-driver.handler';

// Queries
import { GetDriversListHandler } from '@driver/application/queries/v1/get-drivers-list/handlers/get-drivers-list.handler';
import { GetDriverByIdHandler } from '@driver/application/queries/v1/get-driver-by-id/handlers/get-driver-by-id.handler';

// Controllers
import { CreateDriverController } from '@driver/interfaces/http/v1/create-driver/create-driver.controller';
import { UpdateDriverController } from '@driver/interfaces/http/v1/update-driver/update-driver.controller';
import { GetDriversListController } from '@driver/interfaces/http/v1/get-drivers-list/get-drivers-list.controller';
import { GetDriverByIdController } from '@driver/interfaces/http/v1/get-driver-by-id/get-driver-by-id.controller';

const Handlers = [
  CreateDriverHandler,
  UpdateDriverHandler,
  GetDriversListHandler,
  GetDriverByIdHandler,
];

const Repositories = [
  {
    provide: 'DriverInfoRepository',
    useClass: TypeOrmDriverInfoRepository,
  },
];

@Module({
  imports: [
    TypeOrmModule.forFeature([DriverInfoEntity]),
    UserModule,
    TenantModule,
    CqrsModule,
  ],
  controllers: [
    CreateDriverController,
    UpdateDriverController,
    GetDriversListController,
    GetDriverByIdController,
  ],
  providers: [
    ...Repositories,
    ...Handlers,
  ],
  exports: ['DriverInfoRepository'],
})
export class DriverModule {}
