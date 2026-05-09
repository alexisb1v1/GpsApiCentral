import { Controller, Delete, Param, ParseUUIDPipe, Ip, Headers } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SoftDeleteUserCommand } from '@user/application/commands/v1/soft-delete-user/soft-delete-user.command';
import { matchResult } from '@common/http/match-result';
import { CurrentUser, UserContext } from '@shared/infrastructure/decorators/current-user.decorator';

@ApiTags('User')
@Controller('v1/user')
export class SoftDeleteUserController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete(':id')
  @ApiOperation({ summary: 'Desactivar un usuario (Eliminación lógica)' })
  @ApiResponse({ status: 204, description: 'Usuario desactivado exitosamente' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async execute(
    @Param('id', ParseUUIDPipe) id: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @CurrentUser() user: UserContext,
  ) {
    const result = await this.commandBus.execute(
      new SoftDeleteUserCommand(
        id,
        user.tenantId,
        user.userId,
        ip,
        userAgent
      )
    );

    return matchResult(result, () => undefined);
  }
}
