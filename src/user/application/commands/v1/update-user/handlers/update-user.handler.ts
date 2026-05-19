import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { UpdateUserCommand } from '../update-user.command';
import { UserRepository } from '@user/domain/repositories/user.repository';
import { UserEntity } from '@user/domain/entities/user.entity';
import { AppError } from '@shared/domain/errors/app-errors';
import { AuditService } from '@shared/application/services/audit.service';
import { RegisterStatus } from '@shared/domain/enums/register-status.enum';

@CommandHandler(UpdateUserCommand)
export class UpdateUserHandler implements ICommandHandler<UpdateUserCommand> {
  constructor(
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(command: UpdateUserCommand): Promise<Result<UserEntity, AppError>> {
    // 1. Buscar si existe
    const result = await this.userRepository.findById(command.id);
    if (result.isErr()) return err(result.error);

    const user = result.value;
    const oldValues = { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status };

    // 2. Si cambia el email, validar que no esté en uso
    if (command.email && command.email !== user.email) {
      const existing = await this.userRepository.findByEmail(command.email);
      if (existing.isOk()) return err('ALREADY_EXISTS');
      user.email = command.email;
    }

    // 3. Actualizar campos
    if (command.name) user.name = command.name;
    if (command.role) user.role = command.role;
    if (command.isActive !== undefined) {
      user.status = command.isActive ? RegisterStatus.ACTIVE : RegisterStatus.DELETE;
      
      // Sincronizar el estado del chofer si el rol es DRIVER y tiene ficha de conductor
      if (user.role === 'DRIVER' && user.driverInfo) {
        user.driverInfo.status = command.isActive ? RegisterStatus.ACTIVE : RegisterStatus.DELETE;
      }
    }

    // 4. Guardar
    const saveResult = await this.userRepository.save(user);

    if (saveResult.isOk()) {
      // 5. Registrar en auditoría
      this.auditService.createLog({
        tenantId: user.tenantId,
        userId: command.userId,
        action: 'UPDATE_USER',
        entityName: 'users',
        entityId: user.id,
        oldValues: oldValues,
        newValues: { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status },
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
      });
    }

    return saveResult;
  }
}
