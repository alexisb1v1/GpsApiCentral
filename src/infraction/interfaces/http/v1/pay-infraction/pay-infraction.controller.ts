import { Controller, Patch, Param, Body, Req, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PayInfractionDto } from './dto/pay-infraction.dto';
import { PayInfractionCommand } from '@infraction/application/commands/v1/pay-infraction/pay-infraction.command';
import { matchResult } from '@common/http/match-result';
import { Audit, AuditContext } from '@shared/infrastructure/decorators/audit-context.decorator';
import { Roles } from '@shared/infrastructure/decorators/roles.decorator';
import { RolesGuard } from '@shared/infrastructure/guards/roles.guard';

@ApiTags('Infractions')
@ApiBearerAuth()
@Controller('v1/infractions')
export class PayInfractionController {
  constructor(private readonly commandBus: CommandBus) {}

  @Patch(':id/pay')
  @Roles('ADMIN', 'OPERATOR')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Registrar el pago de una infracción' })
  async execute(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: PayInfractionDto,
    @Req() req: any,
    @Audit() audit: AuditContext,
  ) {
    const result = await this.commandBus.execute(
      new PayInfractionCommand(
        id,
        req.user.tenantId,
        req.user.sub,
        dto.paymentId,
        audit.ip,
        audit.userAgent,
      ),
    );

    return matchResult(result);
  }
}
