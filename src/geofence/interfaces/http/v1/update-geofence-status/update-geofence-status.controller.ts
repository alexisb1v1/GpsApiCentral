import { Controller, Patch, Param, Body, Req } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UpdateGeofenceStatusRequestDto } from './dto/update-geofence-status.request.dto';
import { UpdateGeofenceStatusCommand } from '@geofence/application/commands/v1/update-geofence-status/update-geofence-status.command';
import { matchResult } from '@common/http/match-result';
import { Audit, AuditContext } from '@shared/infrastructure/decorators/audit-context.decorator';

@ApiTags('Geofences')
@ApiBearerAuth()
@Controller('v1/geofences')
export class UpdateGeofenceStatusController {
  constructor(private readonly commandBus: CommandBus) {}

  @Patch(':id/status')
  @ApiOperation({ summary: 'Actualizar el estado de una geocerca' })
  async execute(
    @Param('id') id: string,
    @Body() dto: UpdateGeofenceStatusRequestDto,
    @Req() req: any,
    @Audit() audit: AuditContext,
  ) {
    const result = await this.commandBus.execute(
      new UpdateGeofenceStatusCommand(
        id,
        dto.status,
        req.user.tenantId,
        req.user.sub,
        audit.ip,
        audit.userAgent,
      ),
    );

    return matchResult(result);
  }
}
