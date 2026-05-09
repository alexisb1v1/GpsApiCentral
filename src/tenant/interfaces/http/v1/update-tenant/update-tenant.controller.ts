import { Controller, Patch, Param, Body, ParseUUIDPipe, Ip, Headers } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UpdateTenantRequestDto } from './dto/update-tenant.request.dto';
import { UpdateTenantCommand } from '@tenant/application/commands/v1/update-tenant/update-tenant.command';
import { matchResult } from '@common/http/match-result';
import { CreateTenantResponseDto } from '@tenant/interfaces/http/v1/create-tenant/dto/create-tenant.response.dto';
import { CurrentUser, UserContext } from '@shared/infrastructure/decorators/current-user.decorator';

@ApiTags('Tenant')
@Controller('v1/tenant')
export class UpdateTenantController {
  constructor(private readonly commandBus: CommandBus) {}

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar datos de una empresa' })
  @ApiResponse({ status: 200, type: CreateTenantResponseDto })
  @ApiResponse({ status: 404, description: 'Empresa no encontrada' })
  @ApiResponse({ status: 409, description: 'El subdominio ya existe' })
  async execute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantRequestDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @CurrentUser() user?: UserContext,
  ) {
    const result = await this.commandBus.execute(
      new UpdateTenantCommand(
        id, 
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
      (tenant) => new CreateTenantResponseDto(tenant)
    );
  }
}
