import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeofenceEntity } from '../../domain/entities/geofence.entity';
import { TypeOrmGeofenceRepository } from '../persistence/typeorm-geofence.repository';
import { CreateGeofenceController } from '../../interfaces/http/v1/create-geofence/create-geofence.controller';
import { GetGeofencesListController } from '../../interfaces/http/v1/get-geofences-list/get-geofences-list.controller';
import { UpdateGeofenceStatusController } from '../../interfaces/http/v1/update-geofence-status/update-geofence-status.controller';
import { CreateGeofenceHandler } from '../../application/commands/v1/create-geofence/handlers/create-geofence.handler';
import { UpdateGeofenceStatusHandler } from '../../application/commands/v1/update-geofence-status/handlers/update-geofence-status.handler';
import { GetGeofencesListHandler } from '../../application/queries/v1/get-geofences-list/handlers/get-geofences-list.handler';

const CommandHandlers = [CreateGeofenceHandler, UpdateGeofenceStatusHandler];
const QueryHandlers = [GetGeofencesListHandler];

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([GeofenceEntity]),
  ],
  controllers: [
    CreateGeofenceController,
    GetGeofencesListController,
    UpdateGeofenceStatusController,
  ],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    {
      provide: 'GeofenceRepository',
      useClass: TypeOrmGeofenceRepository,
    },
  ],
  exports: ['GeofenceRepository'],
})
export class GeofenceModule {}
