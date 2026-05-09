import { Controller, Post, Param, Body, ParseUUIDPipe } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ResetPasswordRequestDto } from './dto/reset-password.request.dto';
import { ResetPasswordCommand } from '@user/application/commands/v1/reset-password/reset-password.command';
import { matchResult } from '@common/http/match-result';

@ApiTags('User Admin')
@Controller('v1/user')
export class ResetPasswordController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('reset-password/:id')
  @ApiOperation({ summary: 'Reiniciar contraseña de un usuario (Acción de Administrador)' })
  @ApiResponse({ status: 200, description: 'Contraseña reiniciada exitosamente' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async execute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordRequestDto,
  ) {
    const result = await this.commandBus.execute(new ResetPasswordCommand(id, dto.newPassword));

    return matchResult(result, () => ({ message: 'Contraseña reiniciada correctamente' }));
  }
}
