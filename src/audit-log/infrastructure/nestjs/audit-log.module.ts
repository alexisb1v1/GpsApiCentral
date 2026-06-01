import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { AuditLogEntity } from '@shared/domain/entities/audit-log.entity';
import { GetAuditLogsController } from '../../interfaces/http/v1/get-audit-logs/get-audit-logs.controller';
import { GetAuditLogsHandler } from '../../application/queries/v1/get-audit-logs/handlers/get-audit-logs.handler';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLogEntity]),
    CqrsModule,
  ],
  controllers: [
    GetAuditLogsController,
  ],
  providers: [
    GetAuditLogsHandler,
  ],
})
export class AuditLogModule {}
