import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { GetDriverByIdQuery } from '../get-driver-by-id.query';
import { UserRepository } from '@user/domain/repositories/user.repository';
import { UserEntity } from '@user/domain/entities/user.entity';
import { AppError } from '@shared/domain/errors/app-errors';

@QueryHandler(GetDriverByIdQuery)
export class GetDriverByIdHandler implements IQueryHandler<GetDriverByIdQuery> {
  constructor(
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
  ) {}

  async execute(query: GetDriverByIdQuery): Promise<Result<UserEntity, AppError>> {
    const result = await this.userRepository.findById(query.id);
    if (result.isErr()) {
      return err('NOT_FOUND');
    }
    const user = result.value;
    if (user.role !== 'DRIVER') {
      return err('INVALID_INPUT');
    }
    return ok(user);
  }
}
