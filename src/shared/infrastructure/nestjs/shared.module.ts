import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogEntity } from '../../domain/entities/audit-log.entity';
import { DocumentSequenceEntity } from '../../domain/entities/document-sequence.entity';
import { AuditService } from '../../application/services/audit.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLogEntity, DocumentSequenceEntity]),
  ],
  providers: [
    AuditService,
  ],
  exports: [
    AuditService,
    TypeOrmModule,
  ],
})
export class SharedModule {}
