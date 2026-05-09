import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { Result } from 'neverthrow';
import { GetTenantByIdQuery } from '../get-tenant-by-id.query';
import { TenantRepository } from '@tenant/domain/repositories/tenant.repository';
import { TenantEntity } from '@tenant/domain/entities/tenant.entity';
import { AppError } from '@shared/domain/errors/app-errors';

@QueryHandler(GetTenantByIdQuery)
export class GetTenantByIdHandler implements IQueryHandler<GetTenantByIdQuery> {
  constructor(
    @Inject('TenantRepository')
    private readonly tenantRepository: TenantRepository,
  ) {}

  async execute(query: GetTenantByIdQuery): Promise<Result<TenantEntity, AppError>> {
    return await this.tenantRepository.findById(query.id);
  }
}
