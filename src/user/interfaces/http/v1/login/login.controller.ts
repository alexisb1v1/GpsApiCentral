import { Controller, Post, Body } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LoginRequestDto, LoginResponseDto } from './dto/login.request.dto';
import { LoginCommand } from '@user/application/commands/v1/login/login.command';
import { matchResult } from '@common/http/match-result';
import { Public } from '@shared/infrastructure/decorators/public.decorator';

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
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const result = await this.commandBus.execute(
      new LoginCommand(dto.email, dto.password, ip, userAgent)
    );

    return matchResult(
      result,
      (data) => data,
      { UNAUTHORIZED: 'Correo electrónico o contraseña incorrectos' }
    );
  }
}
