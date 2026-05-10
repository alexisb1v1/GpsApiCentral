import { Controller, Delete, Param, Req } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SoftDeleteTenantCommand } from '@tenant/application/commands/v1/soft-delete-tenant/soft-delete-tenant.command';
import { matchResult } from '@common/http/match-result';
import { Audit, AuditContext } from '@shared/infrastructure/decorators/audit-context.decorator';

@ApiTags('Tenants')
@ApiBearerAuth()
@Controller('v1/tenants')
export class SoftDeleteTenantController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete(':id')
  @ApiOperation({ summary: 'Desactivar una empresa (Soft Delete)' })
  async execute(
    @Param('id') id: string,
    @Req() req: any,
    @Audit() audit: AuditContext,
  ) {
    const result = await this.commandBus.execute(
      new SoftDeleteTenantCommand(
        id,
        req.user.sub,
        audit.ip,
        audit.userAgent,
      ),
    );

    return matchResult(result);
  }
}
