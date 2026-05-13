import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { Result, ok, err } from 'neverthrow';
import { VerifyTenantDomainQuery } from '../verify-tenant-domain.query';
import { TenantRepository } from '@tenant/domain/repositories/tenant.repository';
import { AppError } from '@shared/domain/errors/app-errors';

@QueryHandler(VerifyTenantDomainQuery)
export class VerifyTenantDomainHandler implements IQueryHandler<VerifyTenantDomainQuery> {
  constructor(
    @Inject('TenantRepository')
    private readonly tenantRepository: TenantRepository,
  ) {}

  async execute(query: VerifyTenantDomainQuery): Promise<Result<void, AppError>> {
    const { fullDomain } = query;

    // 1. Extraemos el subdominio (la parte antes del primer punto)
    // Ejemplo: "transportesanjuan.centralafbv.com" -> "transportesanjuan"
    const subdomain = fullDomain.split('.')[0];

    if (!subdomain) {
      return err('NOT_FOUND');
    }

    // 3. Consultamos a la base de datos
    const result = await this.tenantRepository.findBySubdomain(subdomain);

    if (result.isErr()) {
      return err(result.error);
    }

    const tenant = result.value;

    // 4. Verificamos si está activo
    if (!tenant.isActive) {
      return err('FORBIDDEN');
    }

    return ok(undefined);
  }
}
