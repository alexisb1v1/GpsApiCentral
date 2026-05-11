import { Controller, Post, Body, Req } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CreateTenantRequestDto } from './dto/create-tenant.request.dto';
import { CreateTenantCommand } from '@tenant/application/commands/v1/create-tenant/create-tenant.command';
import { matchResult } from '@common/http/match-result';
import { Audit, AuditContext } from '@shared/infrastructure/decorators/audit-context.decorator';

@ApiTags('Tenants')
@ApiBearerAuth()
@Controller('v1/tenants')
export class CreateTenantController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('create')
  @ApiOperation({ summary: 'Crear una nueva empresa (Tenant)' })
  async execute(
    @Body() dto: CreateTenantRequestDto,
    @Req() req: any,
    @Audit() audit: AuditContext,
  ) {
    const result = await this.commandBus.execute(
      new CreateTenantCommand(
        dto.name,
        dto.subdomain,
        dto.isActive,
        dto.logoUrl,
        dto.primaryColor,
        dto.accentColor,
        dto.statusDotColor,
        req.user.sub,
        audit.ip,
        audit.userAgent,
      ),
    );

    return matchResult(result);
  }
}
