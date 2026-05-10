import { Controller, Post, Body, Req } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CreateInfractionRequestDto } from './dto/create-infraction.request.dto';
import { CreateInfractionCommand } from '@infraction/application/commands/v1/create-infraction/create-infraction.command';
import { matchResult } from '@common/http/match-result';
import { Audit, AuditContext } from '@shared/infrastructure/decorators/audit-context.decorator';

@ApiTags('Infractions')
@ApiBearerAuth()
@Controller('v1/infractions')
export class CreateInfractionController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('create')
  @ApiOperation({ summary: 'Registrar una nueva infracción' })
  async execute(
    @Body() dto: CreateInfractionRequestDto,
    @Req() req: any,
    @Audit() audit: AuditContext,
  ) {
    const result = await this.commandBus.execute(
      new CreateInfractionCommand(
        dto.tenantId,
        dto.vehicleId,
        dto.infractionTypeId,
        dto.description,
        dto.amount,
        dto.infractionDate,
        req.user.sub,
        audit.ip,
        audit.userAgent,
      ),
    );

    return matchResult(result);
  }
}
