import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { CreateTenantCommand } from '../create-tenant.command';
import { TenantRepository } from '@tenant/domain/repositories/tenant.repository';
import { TenantEntity } from '@tenant/domain/entities/tenant.entity';
import { AppError } from '@shared/domain/errors/app-errors';
import { AuditService } from '@shared/application/services/audit.service';

@CommandHandler(CreateTenantCommand)
export class CreateTenantHandler implements ICommandHandler<CreateTenantCommand> {
  constructor(
    @Inject('TenantRepository')
    private readonly tenantRepository: TenantRepository,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Ejecuta la creación de un nuevo Tenant.
   * 
   * @param command - Datos del tenant (nombre, subdominio)
   * @returns Result con la entidad creada o error si el subdominio ya existe
   */
  async execute(command: CreateTenantCommand): Promise<Result<TenantEntity, AppError>> {
    // 1. Validar si el subdominio ya existe
    const existingResult = await this.tenantRepository.findBySubdomain(command.subdomain);
    if (existingResult.isOk()) {
      return err('ALREADY_EXISTS');
    }

    // 2. Crear nueva entidad
    const newTenant = new TenantEntity();
    newTenant.name = command.name;
    newTenant.subdomain = command.subdomain;
    newTenant.isActive = command.isActive ?? true;
    newTenant.logoUrl = command.logoUrl ?? null;
    newTenant.loginUrl = command.loginUrl ?? null;
    newTenant.primaryColor = command.primaryColor ?? null;
    newTenant.accentColor = command.accentColor ?? null;
    newTenant.statusDotColor = command.statusDotColor ?? null;
    newTenant.address = command.address ?? null;
    newTenant.phone = command.phone ?? null;
    newTenant.taxId = command.taxId ?? null;

    // 3. Guardar en persistencia
    const saveResult = await this.tenantRepository.save(newTenant);

    if (saveResult.isOk()) {
      // 4. Registrar en auditoría
      const tenant = saveResult.value;
      this.auditService.createLog({
        tenantId: tenant.id, // El log pertenece al nuevo tenant
        userId: command.userId,
        action: 'CREATE_TENANT',
        entityName: 'tenants',
        entityId: tenant.id,
        newValues: { 
          id: tenant.id, 
          name: tenant.name, 
          subdomain: tenant.subdomain,
          logoUrl: tenant.logoUrl,
          primaryColor: tenant.primaryColor,
          accentColor: tenant.accentColor,
          statusDotColor: tenant.statusDotColor,
          address: tenant.address,
          phone: tenant.phone,
          taxId: tenant.taxId
        },
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
      });
    }

    return saveResult;
  }
}
