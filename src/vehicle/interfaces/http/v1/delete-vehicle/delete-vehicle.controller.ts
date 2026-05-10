import { Controller, Delete, Param, Req } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DeleteVehicleCommand } from '@vehicle/application/commands/v1/delete-vehicle/delete-vehicle.command';
import { matchResult } from '@common/http/match-result';
import { Audit, AuditContext } from '@shared/infrastructure/decorators/audit-context.decorator';

@ApiTags('Vehicles')
@ApiBearerAuth()
@Controller('v1/vehicles')
export class DeleteVehicleController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar físicamente un vehículo' })
  async execute(
    @Param('id') id: string,
    @Req() req: any,
    @Audit() audit: AuditContext,
  ) {
    const result = await this.commandBus.execute(
      new DeleteVehicleCommand(
        id,
        req.user.sub,
        audit.ip,
        audit.userAgent,
      ),
    );

    return matchResult(result, (data) => data);
  }
}
