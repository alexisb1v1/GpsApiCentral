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
    const baseDomain = '.centralafbv.com';

    // 1. Verificamos que el dominio termine en el dominio principal
    if (!fullDomain.endsWith(baseDomain)) {
      return err('NOT_FOUND');
    }

    // 2. Extraemos el subdominio
    const subdomain = fullDomain.replace(baseDomain, '');

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
