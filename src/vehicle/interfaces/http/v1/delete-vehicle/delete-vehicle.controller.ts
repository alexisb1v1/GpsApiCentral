import { Controller, Delete, Param, Ip, Headers } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DeleteVehicleCommand } from '@vehicle/application/commands/v1/delete-vehicle/delete-vehicle.command';
import { matchResult } from '@common/http/match-result';
import { CurrentUser, UserContext } from '@shared/infrastructure/decorators/current-user.decorator';

@ApiTags('Vehicle')
@Controller('v1/vehicle')
export class DeleteVehicleController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminación lógica de un vehículo' })
  @ApiResponse({ status: 204, description: 'Vehículo eliminado correctamente' })
  @ApiResponse({ status: 404, description: 'Vehículo no encontrado' })
  async execute(
    @Param('id') id: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @CurrentUser() user: UserContext,
  ) {
    const result = await this.commandBus.execute(
      new DeleteVehicleCommand(
        id,
        user.tenantId,
        user.userId,
        ip,
        userAgent,
      ),
    );
    return matchResult(result, () => ({
      success: true,
      message: 'Vehículo eliminado correctamente',
    }));
  }
}
