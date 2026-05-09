import { Controller, Post, Body, Ip, Headers } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreateTenantRequestDto } from './dto/create-tenant.request.dto';
import { CreateTenantCommand } from '@tenant/application/commands/v1/create-tenant/create-tenant.command';
import { matchResult } from '@common/http/match-result';
import { CreateTenantResponseDto } from './dto/create-tenant.response.dto';
import { CurrentUser, UserContext } from '@shared/infrastructure/decorators/current-user.decorator';

@ApiTags('Tenant')
@Controller('v1/tenant')
export class CreateTenantController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @ApiOperation({ summary: 'Crear una nueva empresa (Tenant)' })
  @ApiResponse({ status: 201, description: 'Empresa creada exitosamente', type: CreateTenantResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 409, description: 'El subdominio ya existe' })
  async execute(
    @Body() dto: CreateTenantRequestDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @CurrentUser() user?: UserContext,
  ) {
    const result = await this.commandBus.execute(
      new CreateTenantCommand(
        dto.name, 
        dto.subdomain, 
        dto.isActive,
        user?.userId,
        ip,
        userAgent
      )
    );

    return matchResult(
      result,
      (tenant) => new CreateTenantResponseDto(tenant),
      { ALREADY_EXISTS: 'El subdominio ya está en uso por otra empresa' }
    );
  }
}
