import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouteEntity } from '../../domain/entities/route.entity';
import { RouteStopEntity } from '../../domain/entities/route-stop.entity';
import { TypeOrmRouteRepository } from '../persistence/typeorm-route.repository';
import { CreateRouteController } from '../../interfaces/http/v1/create-route/create-route.controller';
import { CreateRouteHandler } from '../../application/commands/v1/create-route/handlers/create-route.handler';
import { GetRoutesListController } from '../../interfaces/http/v1/get-routes-list/get-routes-list.controller';
import { GetRoutesListHandler } from '../../application/queries/v1/get-routes-list/handlers/get-routes-list.handler';
import { UpdateRouteStopsController } from '../../interfaces/http/v1/update-route-stops/update-route-stops.controller';
import { UpdateRouteStopsHandler } from '../../application/commands/v1/update-route-stops/handlers/update-route-stops.handler';
import { GetRouteDetailController } from '../../interfaces/http/v1/get-route-detail/get-route-detail.controller';
import { GetRouteDetailHandler } from '../../application/queries/v1/get-route-detail/handlers/get-route-detail.handler';
import { SharedModule } from '@shared/infrastructure/nestjs/shared.module';

const Handlers = [
  CreateRouteHandler,
  GetRoutesListHandler,
  UpdateRouteStopsHandler,
  GetRouteDetailHandler,
];

const Repositories = [
  {
    provide: 'RouteRepository',
    useClass: TypeOrmRouteRepository,
  },
];

@Module({
  imports: [
    TypeOrmModule.forFeature([RouteEntity, RouteStopEntity]),
    CqrsModule,
    SharedModule,
  ],
  controllers: [
    CreateRouteController,
    GetRoutesListController,
    UpdateRouteStopsController,
    GetRouteDetailController,
  ],
  providers: [...Repositories, ...Handlers],
  exports: ['RouteRepository', TypeOrmModule],
})
export class RouteModule {}
