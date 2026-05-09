import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ChangePasswordCommand } from '../change-password.command';
import { UserRepository } from '@user/domain/repositories/user.repository';
import { AppError } from '@shared/domain/errors/app-errors';

@CommandHandler(ChangePasswordCommand)
export class ChangePasswordHandler implements ICommandHandler<ChangePasswordCommand> {
  constructor(
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
  ) {}

  async execute(command: ChangePasswordCommand): Promise<Result<void, AppError>> {
    // 1. Buscar usuario
    const result = await this.userRepository.findById(command.userId);
    if (result.isErr()) return err(result.error);

    const user = result.value;

    // 2. Validar password actual
    const isCurrentValid = await bcrypt.compare(command.currentPassword, user.password);
    if (!isCurrentValid) {
      return err('UNAUTHORIZED'); // O podrías usar un error específico como INVALID_CREDENTIALS
    }

    // 3. Hashear y guardar nueva password
    user.password = await bcrypt.hash(command.newPassword, 10);
    
    const saveResult = await this.userRepository.save(user);
    if (saveResult.isErr()) return err(saveResult.error);

    return ok(undefined);
  }
}
