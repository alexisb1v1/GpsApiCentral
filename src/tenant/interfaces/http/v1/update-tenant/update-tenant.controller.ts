import { Controller, Put, Param, Body, Req } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UpdateTenantRequestDto } from './dto/update-tenant.request.dto';
import { UpdateTenantCommand } from '@tenant/application/commands/v1/update-tenant/update-tenant.command';
import { matchResult } from '@common/http/match-result';
import { Audit, AuditContext } from '@shared/infrastructure/decorators/audit-context.decorator';

@ApiTags('Tenants')
@ApiBearerAuth()
@Controller('v1/tenants')
export class UpdateTenantController {
  constructor(private readonly commandBus: CommandBus) {}

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar datos de una empresa' })
  async execute(
    @Param('id') id: string,
    @Body() dto: UpdateTenantRequestDto,
    @Req() req: any,
    @Audit() audit: AuditContext,
  ) {
    const result = await this.commandBus.execute(
      new UpdateTenantCommand(
        id,
        dto.name,
        dto.subdomain,
        dto.isActive,
        dto.logoUrl,
        dto.primaryColor,
        dto.accentColor,
        dto.statusDotColor,
        dto.address,
        dto.phone,
        dto.taxId,
        req.user.sub,
        audit.ip,
        audit.userAgent,
      ),
    );

    return matchResult(result);
  }
}
