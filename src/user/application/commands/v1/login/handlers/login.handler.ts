import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginCommand } from '../login.command';
import { UserRepository } from '@user/domain/repositories/user.repository';
import { AppError } from '@shared/domain/errors/app-errors';
import { AuditService } from '@shared/application/services/audit.service';

@CommandHandler(LoginCommand)
export class LoginHandler implements ICommandHandler<LoginCommand> {
  constructor(
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  async execute(command: LoginCommand): Promise<Result<{ accessToken: string }, AppError>> {
    // 1. Buscar usuario por email
    const result = await this.userRepository.findByEmail(command.email);
    if (result.isErr()) return err('UNAUTHORIZED');

    const user = result.value;

    // 2. Validar si está activo
    if (!user.isActive) return err('UNAUTHORIZED');

    // 3. Validar password
    const isPasswordValid = await bcrypt.compare(command.password, user.password);
    if (!isPasswordValid) return err('UNAUTHORIZED');

    // 4. Generar Payload
    const payload = { 
      sub: user.id, 
      email: user.email, 
      tenantId: user.tenantId, 
      role: user.role 
    };

    const token = this.jwtService.sign(payload);

    // 5. Registrar en auditoría
    this.auditService.createLog({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'LOGIN',
      entityName: 'auth',
      entityId: user.id,
      ipAddress: command.ipAddress,
      userAgent: command.userAgent,
    });

    // 6. Retornar Token
    return ok({
      accessToken: token,
    });
  }
}
