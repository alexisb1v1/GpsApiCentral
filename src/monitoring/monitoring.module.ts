import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { VehicleEntity } from '@vehicle/domain/entities/vehicle.entity';
import { DailyTicketEntity } from '@daily-ticket/domain/entities/daily-ticket.entity';
import { VehicleTenantCache } from './infrastructure/cache/vehicle-tenant.cache';
import { TraccarSocketService } from './infrastructure/traccar/traccar-socket.service';
import { MonitoringGateway } from './interfaces/ws/monitoring.gateway';
import { DailyTicketModule } from '@daily-ticket/infrastructure/nestjs/daily-ticket.module';

@Module({
  imports: [
    ConfigModule,
    // Importamos JwtModule de forma dinámica usando el secreto de entorno
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'GpsCentralSecr3tK3y2026S4nju4n',
      signOptions: { expiresIn: '24h' },
    }),
    // Habilitamos acceso directo a entidades para la precarga en memoria
    TypeOrmModule.forFeature([VehicleEntity, DailyTicketEntity]),
    // Usamos forwardRef para resolver la dependencia circular con DailyTicketModule
    forwardRef(() => DailyTicketModule),
  ],
  providers: [
    VehicleTenantCache,
    TraccarSocketService,
    MonitoringGateway,
  ],
  exports: [
    VehicleTenantCache,
    TraccarSocketService,
  ],
})
export class MonitoringModule {}
