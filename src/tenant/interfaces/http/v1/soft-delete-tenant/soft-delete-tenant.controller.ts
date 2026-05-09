import { Controller, Delete, Param, ParseUUIDPipe, Ip, Headers } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SoftDeleteTenantCommand } from '@tenant/application/commands/v1/soft-delete-tenant/soft-delete-tenant.command';
import { matchResult } from '@common/http/match-result';
import { CurrentUser, UserContext } from '@shared/infrastructure/decorators/current-user.decorator';

@ApiTags('Tenant')
@Controller('v1/tenant')
export class SoftDeleteTenantController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete(':id')
  @ApiOperation({ summary: 'Desactivar una empresa (Eliminación lógica)' })
  @ApiResponse({ status: 204, description: 'Empresa desactivada exitosamente' })
  @ApiResponse({ status: 404, description: 'Empresa no encontrada' })
  async execute(
    @Param('id', ParseUUIDPipe) id: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @CurrentUser() user?: UserContext,
  ) {
    const result = await this.commandBus.execute(
      new SoftDeleteTenantCommand(
        id,
        user?.userId,
        ip,
        userAgent
      )
    );

    return matchResult(
      result,
      () => undefined // 204 No Content
    );
  }
}
