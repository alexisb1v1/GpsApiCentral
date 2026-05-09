import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from '../../domain/entities/audit-log.entity';

export interface AuditLogData {
  tenantId: string;
  userId?: string | null;
  action: string;
  entityName: string;
  entityId?: string | null;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditRepository: Repository<AuditLogEntity>,
  ) {}

  /**
   * Registra una acción en los logs de auditoría.
   * Se ejecuta de forma asíncrona sin esperar a que termine para no bloquear el flujo principal.
   */
  async createLog(data: AuditLogData): Promise<void> {
    try {
      const log = this.auditRepository.create({
        ...data,
        // Si no viene userId y es un webhook, se podría inferir o marcar aquí, 
        // pero es mejor que el llamador lo especifique como 'system-webhook' en el contexto adecuado.
      });
      await this.auditRepository.save(log);
    } catch (error) {
      // Importante: No lanzar error para no romper la transacción principal
      console.error('Error saving audit log:', error);
    }
  }

  /**
   * Método especializado para registrar acciones de webhooks.
   */
  async createWebhookLog(data: Omit<AuditLogData, 'userId'>): Promise<void> {
    return this.createLog({
      ...data,
      userId: null, // O un UUID específico que represente al sistema si se prefiere
      userAgent: 'system-webhook',
    });
  }
}
