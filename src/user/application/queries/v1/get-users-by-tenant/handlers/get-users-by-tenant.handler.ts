import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { Result } from 'neverthrow';
import { GetUsersByTenantQuery } from '../get-users-by-tenant.query';
import { UserRepository } from '@user/domain/repositories/user.repository';
import { UserEntity } from '@user/domain/entities/user.entity';
import { AppError } from '@shared/domain/errors/app-errors';

@QueryHandler(GetUsersByTenantQuery)
export class GetUsersByTenantHandler implements IQueryHandler<GetUsersByTenantQuery> {
  constructor(
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
  ) {}

  async execute(query: GetUsersByTenantQuery): Promise<Result<UserEntity[], AppError>> {
    return await this.userRepository.findByTenantId(query.tenantId);
  }
}
