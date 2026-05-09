import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogEntity } from '../../domain/entities/audit-log.entity';
import { AuditService } from '../../application/services/audit.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLogEntity]),
  ],
  providers: [
    AuditService,
  ],
  exports: [
    AuditService,
  ],
})
export class SharedModule {}
