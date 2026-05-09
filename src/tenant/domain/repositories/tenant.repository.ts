import { Result } from 'neverthrow';
import { TenantEntity } from '../entities/tenant.entity';
import { AppError } from '@shared/domain/errors/app-errors';

export interface TenantRepository {
  save(tenant: Partial<TenantEntity>): Promise<Result<TenantEntity, AppError>>;
  findById(id: string): Promise<Result<TenantEntity, AppError>>;
  findBySubdomain(subdomain: string): Promise<Result<TenantEntity, AppError>>;
  findAll(): Promise<Result<TenantEntity[], AppError>>;
}
