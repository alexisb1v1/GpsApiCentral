import { Controller, Post, Body } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LoginRequestDto, LoginResponseDto, RefreshTokenRequestDto, RefreshTokenResponseDto } from './dto/login.request.dto';
import { LoginCommand } from '@user/application/commands/v1/login/login.command';
import { RefreshTokenCommand } from '@user/application/commands/v1/refresh-token/refresh-token.command';
import { matchResult } from '@common/http/match-result';
import { Public } from '@shared/infrastructure/decorators/public.decorator';
import { Audit, AuditContext } from '@shared/infrastructure/decorators/audit-context.decorator';

@ApiTags('Auth')
@Controller('v1/auth')
export class LoginController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('login')
  @Public()
  @ApiOperation({ summary: 'Iniciar sesión y obtener token JWT' })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async execute(
    @Body() dto: LoginRequestDto,
    @Audit() audit: AuditContext,
  ) {
    const result = await this.commandBus.execute(
      new LoginCommand(dto.email, dto.password, dto.tenant, audit.ip, audit.userAgent, dto.deviceFingerprint)
    );

    return matchResult(
      result,
      (data) => data,
      { UNAUTHORIZED: 'Correo electrónico o contraseña incorrectos' }
    );
  }

  @Post('refresh')
  @Public()
  @ApiOperation({ summary: 'Renovar el token de acceso utilizando un Refresh Token' })
  @ApiResponse({ status: 200, type: RefreshTokenResponseDto })
  @ApiResponse({ status: 401, description: 'Token de refresco inválido o expirado, o huella digital no coincide' })
  async refresh(
    @Body() dto: RefreshTokenRequestDto,
    @Audit() audit: AuditContext,
  ) {
    const result = await this.commandBus.execute(
      new RefreshTokenCommand(dto.refreshToken, dto.deviceFingerprint, audit.ip, audit.userAgent)
    );

    return matchResult(
      result,
      (data) => data,
      { UNAUTHORIZED: 'Sesión inválida o expirada' }
    );
  }
}
