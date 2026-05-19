import { Result } from 'neverthrow';
import { UserEntity } from '../entities/user.entity';
import { AppError } from '@shared/domain/errors/app-errors';

export interface UserRepository {
  save(user: Partial<UserEntity>): Promise<Result<UserEntity, AppError>>;
  findById(id: string): Promise<Result<UserEntity, AppError>>;
  findByEmail(email: string): Promise<Result<UserEntity, AppError>>;
  findByTenantId(tenantId: string): Promise<Result<UserEntity[], AppError>>;
  findDriversByTenantId(tenantId: string): Promise<Result<UserEntity[], AppError>>;
  findByDniAndTenantId(dni: string, tenantId: string): Promise<Result<UserEntity, AppError>>;
}
