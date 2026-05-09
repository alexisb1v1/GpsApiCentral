import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { SoftDeleteTenantCommand } from '../soft-delete-tenant.command';
import { TenantRepository } from '@tenant/domain/repositories/tenant.repository';
import { AppError } from '@shared/domain/errors/app-errors';
import { AuditService } from '@shared/application/services/audit.service';

@CommandHandler(SoftDeleteTenantCommand)
export class SoftDeleteTenantHandler implements ICommandHandler<SoftDeleteTenantCommand> {
  constructor(
    @Inject('TenantRepository')
    private readonly tenantRepository: TenantRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(command: SoftDeleteTenantCommand): Promise<Result<void, AppError>> {
    // 1. Buscar si existe
    const result = await this.tenantRepository.findById(command.id);
    if (result.isErr()) return err(result.error);

    const tenant = result.value;
    const oldValues = { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain, isActive: tenant.isActive };

    // 2. Desactivar (Eliminación lógica)
    tenant.isActive = false;

    // 3. Guardar
    const saveResult = await this.tenantRepository.save(tenant);
    if (saveResult.isErr()) return err(saveResult.error);

    // 4. Registrar en auditoría
    this.auditService.createLog({
      tenantId: tenant.id,
      userId: command.userId,
      action: 'SOFT_DELETE_TENANT',
      entityName: 'tenants',
      entityId: tenant.id,
      oldValues,
      newValues: { isActive: false },
      ipAddress: command.ipAddress,
      userAgent: command.userAgent,
    });

    return ok(undefined);
  }
}
