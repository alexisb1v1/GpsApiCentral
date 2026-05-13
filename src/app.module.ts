import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { HealthCheckController } from './healthcheck.controller';
import { DatabaseModule } from '@shared/infrastructure/database/database.module';
import { SharedModule } from '@shared/infrastructure/nestjs/shared.module';
import { TenantModule } from './tenant/infrastructure/nestjs/tenant.module';
import { UserModule } from './user/infrastructure/nestjs/user.module';
import { VehicleModule } from './vehicle/infrastructure/nestjs/vehicle.module';
import { JwtAuthGuard } from '@shared/infrastructure/guards/jwt-auth.guard';
import { InfractionModule } from './infraction/infrastructure/nestjs/infraction.module';
import { DailyTicketModule } from './daily-ticket/infrastructure/nestjs/daily-ticket.module';
import { GeofenceModule } from './geofence/infrastructure/nestjs/geofence.module';
import { RouteModule } from './route/infrastructure/nestjs/route.module';
import { TrackingModule } from './tracking/infrastructure/nestjs/tracking.module';
import { StorageModule } from '@shared/infrastructure/storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CqrsModule.forRoot(),
    DatabaseModule,
    SharedModule,
    TenantModule,
    UserModule,
    VehicleModule,
    InfractionModule,
    DailyTicketModule,
    GeofenceModule,
    RouteModule,
    TrackingModule,
    StorageModule,
    // Aquí se importarán los módulos de dominio (ej. GpsModule)
  ],
  controllers: [HealthCheckController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
