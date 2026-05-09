import { Controller, Patch, Body, Param, Ip, Headers } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UpdateVehicleStatusRequestDto } from './dto/update-vehicle-status.request.dto';
import { UpdateVehicleStatusCommand } from '@vehicle/application/commands/v1/update-vehicle-status/update-vehicle-status.command';
import { matchResult } from '@common/http/match-result';
import { UpdateVehicleStatusResponseDto } from './dto/update-vehicle-status.response.dto';
import { CurrentUser, UserContext } from '@shared/infrastructure/decorators/current-user.decorator';

@ApiTags('Vehicle')
@Controller('v1/vehicle')
export class UpdateVehicleStatusController {
  constructor(private readonly commandBus: CommandBus) {}

  @Put('update-status/:vehicleId')
  @ApiOperation({ summary: 'Cambiar el estado de un vehículo' })
  @ApiResponse({ status: 200, description: 'Estado actualizado exitosamente', type: UpdateVehicleStatusResponseDto })
  @ApiResponse({ status: 404, description: 'Vehículo no encontrado' })
  async execute(
    @Param('vehicleId') vehicleId: string,
    @Body() dto: UpdateVehicleStatusRequestDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @CurrentUser() user: UserContext,
  ) {
    const result = await this.commandBus.execute(
      new UpdateVehicleStatusCommand(
        vehicleId, 
        dto.status,
        user.tenantId,
        user.userId,
        ip,
        userAgent
      ),
    );

    return matchResult(
      result,
      (vehicle) => new UpdateVehicleStatusResponseDto(true, 'Estado del vehículo actualizado correctamente', vehicle),
    );
  }
}
