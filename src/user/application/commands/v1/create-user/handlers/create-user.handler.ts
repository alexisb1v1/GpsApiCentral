import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CreateUserCommand } from '../create-user.command';
import { UserRepository } from '@user/domain/repositories/user.repository';
import { UserEntity } from '@user/domain/entities/user.entity';
import { TenantRepository } from '@tenant/domain/repositories/tenant.repository';
import { AppError } from '@shared/domain/errors/app-errors';
import { AuditService } from '@shared/application/services/audit.service';

@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  constructor(
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
    @Inject('TenantRepository')
    private readonly tenantRepository: TenantRepository,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Ejecuta la creación de un nuevo usuario vinculado a un Tenant.
   * 
   * @param command - Datos del usuario (email, password, tenantId, etc.)
   * @returns Result con la entidad creada o error si el email existe o el tenant no existe
   */
  async execute(command: CreateUserCommand): Promise<Result<UserEntity, AppError>> {
    // 1. Validar que el Tenant exista
    const tenantResult = await this.tenantRepository.findById(command.tenantId);
    if (tenantResult.isErr()) {
      return err('NOT_FOUND');
    }

    // 2. Validar si el email ya existe
    const existingUser = await this.userRepository.findByEmail(command.email);
    if (existingUser.isOk()) {
      return err('ALREADY_EXISTS');
    }

    // 3. Hashear la contraseña
    const hashedPassword = await bcrypt.hash(command.password, 10);

    // 4. Crear nueva entidad
    const newUser = new UserEntity();
    newUser.tenantId = command.tenantId;
    newUser.name = command.name;
    newUser.email = command.email;
    newUser.role = command.role;
    newUser.password = hashedPassword;

    // 5. Guardar
    const saveResult = await this.userRepository.save(newUser);

    if (saveResult.isOk()) {
      // 6. Registrar en auditoría
      const user = saveResult.value;
      this.auditService.createLog({
        tenantId: user.tenantId, // El log pertenece al tenant del nuevo usuario
        userId: command.userId,   // Quién lo creó (si está autenticado)
        action: 'CREATE_USER',
        entityName: 'users',
        entityId: user.id,
        newValues: { id: user.id, email: user.email, role: user.role, name: user.name },
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
      });
    }

    return saveResult;
  }
}
