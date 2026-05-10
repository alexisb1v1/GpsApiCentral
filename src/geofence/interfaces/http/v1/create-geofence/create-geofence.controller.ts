import { Controller, Post, Body, Req } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CreateGeofenceRequestDto } from './dto/create-geofence.request.dto';
import { CreateGeofenceCommand } from '@geofence/application/commands/v1/create-geofence/create-geofence.command';
import { matchResult } from '@common/http/match-result';
import { Audit, AuditContext } from '@shared/infrastructure/decorators/audit-context.decorator';

@ApiTags('Geofences')
@ApiBearerAuth()
@Controller('v1/geofences')
export class CreateGeofenceController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('create')
  @ApiOperation({ summary: 'Registrar una nueva geocerca' })
  async execute(
    @Body() dto: CreateGeofenceRequestDto,
    @Req() req: any,
    @Audit() audit: AuditContext,
  ) {
    const result = await this.commandBus.execute(
      new CreateGeofenceCommand(
        dto.tenantId,
        dto.traccarGeofenceId,
        dto.name,
        dto.type,
        req.user.sub,
        audit.ip,
        audit.userAgent,
      ),
    );

    return matchResult(result);
  }
}
