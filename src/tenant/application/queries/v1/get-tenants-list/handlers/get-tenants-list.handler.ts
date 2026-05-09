import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { Result } from 'neverthrow';
import { GetTenantsListQuery } from '../get-tenants-list.query';
import { TenantRepository } from '@tenant/domain/repositories/tenant.repository';
import { TenantEntity } from '@tenant/domain/entities/tenant.entity';
import { AppError } from '@shared/domain/errors/app-errors';

@QueryHandler(GetTenantsListQuery)
export class GetTenantsListHandler implements IQueryHandler<GetTenantsListQuery> {
  constructor(
    @Inject('TenantRepository')
    private readonly tenantRepository: TenantRepository,
  ) {}

  async execute(_query: GetTenantsListQuery): Promise<Result<TenantEntity[], AppError>> {
    return await this.tenantRepository.findAll();
  }
}
