import { Controller, Put, Param, Body, Req } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UpdateRouteStopsRequestDto } from './dto/update-route-stops.request.dto';
import { UpdateRouteStopsCommand } from '@route/application/commands/v1/update-route-stops/update-route-stops.command';
import { matchResult } from '@common/http/match-result';
import { Audit, AuditContext } from '@shared/infrastructure/decorators/audit-context.decorator';

@ApiTags('Routes')
@ApiBearerAuth()
@Controller('v1/routes')
export class UpdateRouteStopsController {
  constructor(private readonly commandBus: CommandBus) {}

  @Put(':id/stops')
  @ApiOperation({ summary: 'Actualizar las paradas de una ruta' })
  async execute(
    @Param('id') id: string,
    @Body() dto: UpdateRouteStopsRequestDto,
    @Req() req: any,
    @Audit() audit: AuditContext,
  ) {
    const result = await this.commandBus.execute(
      new UpdateRouteStopsCommand(
        id,
        dto.stops,
        req.user.tenantId,
        req.user.sub,
        audit.ip,
        audit.userAgent,
        dto.name,
        dto.isActive,
        dto.coordinates,
      ),
    );

    return matchResult(result);
  }
}
