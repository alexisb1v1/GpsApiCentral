import { Controller, Put, Body, Param, Ip, Headers } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UpdateVehicleRequestDto } from './dto/update-vehicle.request.dto';
import { UpdateVehicleCommand } from '@vehicle/application/commands/v1/update-vehicle/update-vehicle.command';
import { matchResult } from '@common/http/match-result';
import { CurrentUser, UserContext } from '@shared/infrastructure/decorators/current-user.decorator';

@ApiTags('Vehicle')
@Controller('v1/vehicle')
export class UpdateVehicleController {
  constructor(private readonly commandBus: CommandBus) {}

  @Put('update/:id')
  @ApiOperation({ summary: 'Actualizar los datos de un vehículo' })
  @ApiResponse({ status: 200, description: 'Vehículo actualizado exitosamente' })
  @ApiResponse({ status: 404, description: 'Vehículo no encontrado' })
  @ApiResponse({ status: 409, description: 'La placa ya está registrada' })
  async execute(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleRequestDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @CurrentUser() user: UserContext,
  ) {
    const result = await this.commandBus.execute(
      new UpdateVehicleCommand(
        id,
        dto.plate,
        dto.traccarDeviceId || null,
        dto.brand,
        dto.model,
        dto.year,
        user.tenantId,
        user.userId,
        dto.color,
        ip,
        userAgent,
      ),
    );

    return matchResult(result, (vehicle) => ({
      success: true,
      message: 'Vehículo actualizado correctamente',
      data: vehicle,
    }));
  }
}
