import { Controller, Put, Param, Body, Req } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UpdateVehicleRequestDto } from './dto/update-vehicle.request.dto';
import { UpdateVehicleCommand } from '@vehicle/application/commands/v1/update-vehicle/update-vehicle.command';
import { matchResult } from '@common/http/match-result';
import { Audit, AuditContext } from '@shared/infrastructure/decorators/audit-context.decorator';

@ApiTags('Vehicles')
@ApiBearerAuth()
@Controller('v1/vehicles')
export class UpdateVehicleController {
  constructor(private readonly commandBus: CommandBus) {}

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar datos de un vehículo' })
  async execute(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleRequestDto,
    @Req() req: any,
    @Audit() audit: AuditContext,
  ) {
    const result = await this.commandBus.execute(
      new UpdateVehicleCommand(
        id,
        dto.plate,
        dto.traccarDeviceId || null,
        dto.year,
        req.user.tenantId,
        req.user.sub,
        dto.passengerCapacity,
        dto.ownerName,
        dto.ownerPhone,
        dto.status,
        audit.ip,
        audit.userAgent,
      ),
    );

    return matchResult(result);
  }
}
