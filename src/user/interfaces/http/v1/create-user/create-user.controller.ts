import { Controller, Post, Body, Ip, Headers, Optional } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreateUserRequestDto } from './dto/create-user.request.dto';
import { CreateUserCommand } from '@user/application/commands/v1/create-user/create-user.command';
import { matchResult } from '@common/http/match-result';
import { CreateUserResponseDto } from './dto/create-user.response.dto';
import { CurrentUser, UserContext } from '@shared/infrastructure/decorators/current-user.decorator';

@ApiTags('User')
@Controller('v1/user')
export class CreateUserController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo usuario vinculado a un Tenant' })
  @ApiResponse({ status: 201, description: 'Usuario creado exitosamente', type: CreateUserResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Tenant no encontrado' })
  @ApiResponse({ status: 409, description: 'El email ya existe' })
  async execute(
    @Body() dto: CreateUserRequestDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @CurrentUser() user?: UserContext,
  ) {
    const result = await this.commandBus.execute(
      new CreateUserCommand(
        dto.tenantId, 
        dto.name, 
        dto.email, 
        dto.role, 
        dto.password,
        user?.userId,
        ip,
        userAgent
      )
    );

    return matchResult(
      result,
      (user) => new CreateUserResponseDto(user),
      { 
        ALREADY_EXISTS: 'El correo electrónico ya está registrado',
        NOT_FOUND: 'La empresa (Tenant) especificada no existe'
      }
    );
  }
}
