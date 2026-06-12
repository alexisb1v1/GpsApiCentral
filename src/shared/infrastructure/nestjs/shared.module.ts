import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
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
    {
      provide: 'REDIS_CLIENT',
      useFactory: (config: ConfigService) => {
        return new Redis({
          host: config.get<string>('REDIS_HOST') || 'localhost',
          port: config.get<number>('REDIS_PORT') || 6380,
          password: config.get<string>('REDIS_PASSWORD') || undefined,
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [
    AuditService,
    'REDIS_CLIENT',
    TypeOrmModule,
  ],
})
export class SharedModule {}
