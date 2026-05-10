import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { SoftDeleteUserCommand } from '../soft-delete-user.command';
import { UserRepository } from '@user/domain/repositories/user.repository';
import { AppError } from '@shared/domain/errors/app-errors';
import { AuditService } from '@shared/application/services/audit.service';
import { RegisterStatus } from '@shared/domain/enums/register-status.enum';

@CommandHandler(SoftDeleteUserCommand)
export class SoftDeleteUserHandler implements ICommandHandler<SoftDeleteUserCommand> {
  constructor(
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(command: SoftDeleteUserCommand): Promise<Result<void, AppError>> {
    const result = await this.userRepository.findById(command.id);
    if (result.isErr()) return err(result.error);

    const user = result.value;
    const oldValues = { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status };

    user.status = RegisterStatus.DELETE;

    const saveResult = await this.userRepository.save(user);
    if (saveResult.isErr()) return err(saveResult.error);

    // Registrar en auditoría
    this.auditService.createLog({
      tenantId: user.tenantId,
      userId: command.userId,
      action: 'SOFT_DELETE_USER',
      entityName: 'users',
      entityId: user.id,
      oldValues: oldValues,
      newValues: { status: RegisterStatus.DELETE },
      ipAddress: command.ipAddress,
      userAgent: command.userAgent,
    });

    return ok(undefined);
  }
}
