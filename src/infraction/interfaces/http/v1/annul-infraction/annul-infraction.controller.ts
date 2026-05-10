import { Controller, Patch, Param, Body, Req } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnnulInfractionDto } from './dto/annul-infraction.dto';
import { AnnulInfractionCommand } from '@infraction/application/commands/v1/annul-infraction/annul-infraction.command';
import { matchResult } from '@common/http/match-result';
import { Audit, AuditContext } from '@shared/infrastructure/decorators/audit-context.decorator';

@ApiTags('Infractions')
@ApiBearerAuth()
@Controller('v1/infractions')
export class AnnulInfractionController {
  constructor(private readonly commandBus: CommandBus) {}

  @Patch(':id/annul')
  @ApiOperation({ summary: 'Anular una infracción registrada' })
  async execute(
    @Param('id') id: string,
    @Body() dto: AnnulInfractionDto,
    @Req() req: any,
    @Audit() audit: AuditContext,
  ) {
    const result = await this.commandBus.execute(
      new AnnulInfractionCommand(
        id,
        dto.reason,
        req.user.tenantId,
        req.user.sub,
        audit.ip,
        audit.userAgent,
      ),
    );

    return matchResult(result);
  }
}
