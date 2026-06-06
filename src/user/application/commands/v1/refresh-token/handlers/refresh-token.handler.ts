import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { RefreshTokenCommand } from '../refresh-token.command';
import { UserRepository } from '@user/domain/repositories/user.repository';
import { AppError } from '@shared/domain/errors/app-errors';
import { AuditService } from '@shared/application/services/audit.service';
import { RegisterStatus } from '@shared/domain/enums/register-status.enum';

@CommandHandler(RefreshTokenCommand)
export class RefreshTokenHandler implements ICommandHandler<RefreshTokenCommand> {
  constructor(
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  async execute(command: RefreshTokenCommand): Promise<Result<{ token: string; refreshToken: string }, AppError>> {
    // 1. Buscar usuario por el refresh token
    const result = await this.userRepository.findByRefreshToken(command.refreshToken);
    if (result.isErr()) {
      return err('UNAUTHORIZED');
    }

    const user = result.value;

    // 2. Validar estado del usuario
    if (user.status !== RegisterStatus.ACTIVE) {
      return err('UNAUTHORIZED');
    }

    // 3. Validar expiración del refresh token
    if (!user.refreshTokenExpiresAt || new Date() > user.refreshTokenExpiresAt) {
      // Limpiar datos por seguridad si expiró
      user.refreshToken = null;
      user.refreshTokenExpiresAt = null;
      user.refreshTokenFingerprint = null;
      await this.userRepository.save(user);
      return err('UNAUTHORIZED');
    }

    // 4. Validar Device Fingerprint de manera estricta
    if (user.refreshTokenFingerprint !== command.deviceFingerprint) {
      // Intento de suplantación / Robo de sesión: Revocar inmediatamente
      user.refreshToken = null;
      user.refreshTokenExpiresAt = null;
      user.refreshTokenFingerprint = null;
      await this.userRepository.save(user);

      // Registrar alerta crítica en auditoría
      this.auditService.createLog({
        tenantId: user.tenantId,
        userId: user.id,
        action: 'SECURITY_ALERT_FINGERPRINT_MISMATCH',
        entityName: 'auth',
        entityId: user.id,
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
      });

      return err('UNAUTHORIZED');
    }

    // 5. Generar nuevos tokens (Rotación de Refresh Token)
    const payload = { 
      sub: user.id, 
      email: user.email, 
      tenantId: user.tenantId, 
      role: user.role 
    };

    const newAccessToken = this.jwtService.sign(payload);
    const newRefreshToken = randomBytes(64).toString('hex');
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7); // 7 días

    // Guardar nuevo par
    user.refreshToken = newRefreshToken;
    user.refreshTokenExpiresAt = newExpiresAt;

    const saveResult = await this.userRepository.save(user);
    if (saveResult.isErr()) {
      return err('INTERNAL_ERROR');
    }

    // Registrar en auditoría la rotación exitosa
    this.auditService.createLog({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'REFRESH_TOKEN',
      entityName: 'auth',
      entityId: user.id,
      ipAddress: command.ipAddress,
      userAgent: command.userAgent,
    });

    return ok({
      token: newAccessToken,
      refreshToken: newRefreshToken,
    });
  }
}
