import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { UpdateTenantCommand } from '../update-tenant.command';
import { TenantRepository } from '@tenant/domain/repositories/tenant.repository';
import { TenantEntity } from '@tenant/domain/entities/tenant.entity';
import { AppError } from '@shared/domain/errors/app-errors';
import { AuditService } from '@shared/application/services/audit.service';

@CommandHandler(UpdateTenantCommand)
export class UpdateTenantHandler implements ICommandHandler<UpdateTenantCommand> {
  constructor(
    @Inject('TenantRepository')
    private readonly tenantRepository: TenantRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(command: UpdateTenantCommand): Promise<Result<TenantEntity, AppError>> {
    // 1. Buscar si existe
    const result = await this.tenantRepository.findById(command.id);
    if (result.isErr()) return err(result.error);

    const tenant = result.value;
    const oldValues = { 
      id: tenant.id, 
      name: tenant.name, 
      subdomain: tenant.subdomain, 
      isActive: tenant.isActive,
      logoUrl: tenant.logoUrl,
      primaryColor: tenant.primaryColor,
      accentColor: tenant.accentColor,
      statusDotColor: tenant.statusDotColor,
      address: tenant.address,
      phone: tenant.phone,
      taxId: tenant.taxId
    };

    // 2. Si cambia el subdominio, validar que no esté en uso
    if (command.subdomain && command.subdomain !== tenant.subdomain) {
      const existing = await this.tenantRepository.findBySubdomain(command.subdomain);
      if (existing.isOk()) return err('ALREADY_EXISTS');
      tenant.subdomain = command.subdomain;
    }

    // 3. Actualizar campos
    if (command.name) tenant.name = command.name;
    if (command.isActive !== undefined) tenant.isActive = command.isActive;
    if (command.logoUrl !== undefined) tenant.logoUrl = command.logoUrl;
    if (command.primaryColor !== undefined) tenant.primaryColor = command.primaryColor;
    if (command.accentColor !== undefined) tenant.accentColor = command.accentColor;
    if (command.statusDotColor !== undefined) tenant.statusDotColor = command.statusDotColor;
    if (command.address !== undefined) tenant.address = command.address;
    if (command.phone !== undefined) tenant.phone = command.phone;
    if (command.taxId !== undefined) tenant.taxId = command.taxId;

    // 4. Guardar
    const saveResult = await this.tenantRepository.save(tenant);

    if (saveResult.isOk()) {
      const updatedTenant = saveResult.value;
      // 5. Registrar en auditoría
      this.auditService.createLog({
        tenantId: updatedTenant.id,
        userId: command.userId,
        action: 'UPDATE_TENANT',
        entityName: 'tenants',
        entityId: updatedTenant.id,
        oldValues,
        newValues: { 
          id: updatedTenant.id, 
          name: updatedTenant.name, 
          subdomain: updatedTenant.subdomain, 
          isActive: updatedTenant.isActive,
          logoUrl: updatedTenant.logoUrl,
          primaryColor: updatedTenant.primaryColor,
          accentColor: updatedTenant.accentColor,
          statusDotColor: updatedTenant.statusDotColor,
          address: updatedTenant.address,
          phone: updatedTenant.phone,
          taxId: updatedTenant.taxId
        },
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
      });
    }

    return saveResult;
  }
}
