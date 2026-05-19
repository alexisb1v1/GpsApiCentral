import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Result } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { GetDriversListQuery } from '../get-drivers-list.query';
import { UserRepository } from '@user/domain/repositories/user.repository';
import { UserEntity } from '@user/domain/entities/user.entity';
import { AppError } from '@shared/domain/errors/app-errors';

@QueryHandler(GetDriversListQuery)
export class GetDriversListHandler implements IQueryHandler<GetDriversListQuery> {
  constructor(
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
  ) {}

  async execute(query: GetDriversListQuery): Promise<Result<UserEntity[], AppError>> {
    return this.userRepository.findDriversByTenantId(query.tenantId || '');
  }
}
