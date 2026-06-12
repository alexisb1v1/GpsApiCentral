import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { APP_GUARD } from '@nestjs/core';
import { HealthCheckController } from './healthcheck.controller';
import { DatabaseModule } from '@shared/infrastructure/database/database.module';
import { SharedModule } from '@shared/infrastructure/nestjs/shared.module';
import { TenantModule } from './tenant/infrastructure/nestjs/tenant.module';
import { UserModule } from './user/infrastructure/nestjs/user.module';
import { VehicleModule } from './vehicle/infrastructure/nestjs/vehicle.module';
import { DriverModule } from './driver/infrastructure/nestjs/driver.module';
import { JwtAuthGuard } from '@shared/infrastructure/guards/jwt-auth.guard';
import { InfractionModule } from './infraction/infrastructure/nestjs/infraction.module';
import { DailyTicketModule } from './daily-ticket/infrastructure/nestjs/daily-ticket.module';
import { RouteModule } from './route/infrastructure/nestjs/route.module';
import { TrackingModule } from './tracking/infrastructure/nestjs/tracking.module';
import { StorageModule } from '@shared/infrastructure/storage/storage.module';
import { TraccarModule } from '@shared/infrastructure/traccar/traccar.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { PaymentModule } from './payment/infrastructure/nestjs/payment.module';
import { DashboardModule } from './dashboard/infrastructure/nestjs/dashboard.module';
import { AuditLogModule } from './audit-log/infrastructure/nestjs/audit-log.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST') || 'localhost',
          port: config.get<number>('REDIS_PORT') || 6380,
          password: config.get<string>('REDIS_PASSWORD') || undefined,
        },
      }),
      inject: [ConfigService],
    }),
    CqrsModule.forRoot(),
    DatabaseModule,
    SharedModule,
    TenantModule,
    UserModule,
    VehicleModule,
    DriverModule,
    InfractionModule,
    DailyTicketModule,
    PaymentModule,
    RouteModule,
    TrackingModule,
    StorageModule,
    TraccarModule,
    MonitoringModule,
    DashboardModule,
    AuditLogModule,
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
