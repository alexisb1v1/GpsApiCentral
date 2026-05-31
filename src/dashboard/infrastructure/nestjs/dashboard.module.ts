/* src/dashboard/infrastructure/nestjs/dashboard.module.ts */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { VehicleEntity } from '@vehicle/domain/entities/vehicle.entity';
import { DailyTicketEntity } from '@daily-ticket/domain/entities/daily-ticket.entity';
import { InfractionEntity } from '../../../infraction/domain/entities/infraction.entity';
import { PaymentEntity } from '../../../payment/domain/entities/payment.entity';
import { TenantEntity } from '../../../tenant/domain/entities/tenant.entity';
import { GetDashboardMetricsController } from '../../interfaces/http/v1/get-dashboard-metrics.controller';
import { GetDashboardMetricsHandler } from '../../application/queries/v1/get-dashboard-metrics.handler';
import { VerifyTicketHandler } from '../../application/queries/v1/verify-ticket.handler';

@Module({
  imports: [
    TypeOrmModule.forFeature([VehicleEntity, DailyTicketEntity, InfractionEntity, PaymentEntity, TenantEntity]),
    CqrsModule,
  ],
  controllers: [
    GetDashboardMetricsController,
  ],
  providers: [
    GetDashboardMetricsHandler,
    VerifyTicketHandler,
  ],
})
export class DashboardModule {}
