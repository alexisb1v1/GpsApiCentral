import { Controller, Patch, Param, Body, ParseUUIDPipe, Ip, Headers } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UpdateUserRequestDto } from './dto/update-user.request.dto';
import { UpdateUserCommand } from '@user/application/commands/v1/update-user/update-user.command';
import { matchResult } from '@common/http/match-result';
import { CreateUserResponseDto } from '@user/interfaces/http/v1/create-user/dto/create-user.response.dto';
import { CurrentUser, UserContext } from '@shared/infrastructure/decorators/current-user.decorator';

@ApiTags('User')
@Controller('v1/user')
export class UpdateUserController {
  constructor(private readonly commandBus: CommandBus) {}

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar datos de un usuario' })
  @ApiResponse({ status: 200, type: CreateUserResponseDto })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  @ApiResponse({ status: 409, description: 'El email ya existe' })
  async execute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRequestDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @CurrentUser() user: UserContext,
  ) {
    const result = await this.commandBus.execute(
      new UpdateUserCommand(
        id, 
        dto.name, 
        dto.email, 
        dto.role, 
        dto.isActive,
        user.tenantId,
        user.userId,
        ip,
        userAgent
      )
    );

    return matchResult(
      result,
      (user) => new CreateUserResponseDto(user),
      { ALREADY_EXISTS: 'El correo electrónico ya está en uso' }
    );
  }
}
