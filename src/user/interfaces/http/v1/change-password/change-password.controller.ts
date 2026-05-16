import { Controller, Post, Param, Body, ParseUUIDPipe } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ChangePasswordRequestDto } from './dto/change-password.request.dto';
import { ChangePasswordCommand } from '@user/application/commands/v1/change-password/change-password.command';
import { matchResult } from '@common/http/match-result';

@ApiTags('Users')
@Controller('v1/users')
export class ChangePasswordController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('change-password/:id')
  @ApiOperation({ summary: 'Cambiar contraseña propia (Requiere validación de password actual)' })
  @ApiResponse({ status: 200, description: 'Contraseña actualizada exitosamente' })
  @ApiResponse({ status: 401, description: 'La contraseña actual es incorrecta' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async execute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangePasswordRequestDto,
  ) {
    const result = await this.commandBus.execute(
      new ChangePasswordCommand(id, dto.currentPassword, dto.newPassword)
    );

    return matchResult(
      result, 
      () => ({ message: 'Tu contraseña ha sido actualizada con éxito' }),
      { UNAUTHORIZED: 'La contraseña actual no coincide' }
    );
  }
}
