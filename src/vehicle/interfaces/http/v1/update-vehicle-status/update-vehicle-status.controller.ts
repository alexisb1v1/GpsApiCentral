import { Controller, Patch, Param, Body, Req } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UpdateVehicleStatusRequestDto } from './dto/update-vehicle-status.request.dto';
import { UpdateVehicleStatusCommand } from '@vehicle/application/commands/v1/update-vehicle-status/update-vehicle-status.command';
import { matchResult } from '@common/http/match-result';
import { Audit, AuditContext } from '@shared/infrastructure/decorators/audit-context.decorator';

@ApiTags('Vehicles')
@ApiBearerAuth()
@Controller('v1/vehicles')
export class UpdateVehicleStatusController {
  constructor(private readonly commandBus: CommandBus) {}

  @Patch(':id/status')
  @ApiOperation({ summary: 'Actualizar el estado de un vehículo' })
  async execute(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleStatusRequestDto,
    @Req() req: any,
    @Audit() audit: AuditContext,
  ) {
    const result = await this.commandBus.execute(
      new UpdateVehicleStatusCommand(
        id,
        dto.status,
        req.user.sub,
        audit.ip,
        audit.userAgent,
      ),
    );

    return matchResult(result);
  }
}
