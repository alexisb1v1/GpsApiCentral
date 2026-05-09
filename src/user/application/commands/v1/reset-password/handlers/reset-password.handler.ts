import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ResetPasswordCommand } from '../reset-password.command';
import { UserRepository } from '@user/domain/repositories/user.repository';
import { AppError } from '@shared/domain/errors/app-errors';

@CommandHandler(ResetPasswordCommand)
export class ResetPasswordHandler implements ICommandHandler<ResetPasswordCommand> {
  constructor(
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
  ) {}

  async execute(command: ResetPasswordCommand): Promise<Result<void, AppError>> {
    const result = await this.userRepository.findById(command.userId);
    if (result.isErr()) return err(result.error);

    const user = result.value;
    user.password = await bcrypt.hash(command.newPassword, 10);

    const saveResult = await this.userRepository.save(user);
    if (saveResult.isErr()) return err(saveResult.error);

    return ok(undefined);
  }
}
