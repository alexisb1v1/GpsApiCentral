import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { Result, ok, err } from 'neverthrow';
import { GetTenantBrandingQuery } from '../get-tenant-branding.query';
import { TenantRepository } from '@tenant/domain/repositories/tenant.repository';
import { AppError } from '@shared/domain/errors/app-errors';
import { TenantBrandingResponseDto } from '../dto/tenant-branding.response.dto';

@QueryHandler(GetTenantBrandingQuery)
export class GetTenantBrandingHandler implements IQueryHandler<GetTenantBrandingQuery> {
  constructor(
    @Inject('TenantRepository')
    private readonly tenantRepository: TenantRepository,
  ) {}

  async execute(query: GetTenantBrandingQuery): Promise<Result<TenantBrandingResponseDto, AppError>> {
    const tenantResult = await this.tenantRepository.findBySubdomain(query.subdomain);
    
    if (tenantResult.isErr()) {
      return err(tenantResult.error);
    }

    const tenant = tenantResult.value;

    if (!tenant.isActive) {
      return err('FORBIDDEN');
    }
    
    // Solo devolvemos los datos de branding
    return ok(new TenantBrandingResponseDto({
      id: tenant.id,
      name: tenant.name,
      logoUrl: tenant.logoUrl,
      loginUrl: tenant.loginUrl,
      primaryColor: tenant.primaryColor,
      accentColor: tenant.accentColor,
      statusDotColor: tenant.statusDotColor,
    }));
  }
}
