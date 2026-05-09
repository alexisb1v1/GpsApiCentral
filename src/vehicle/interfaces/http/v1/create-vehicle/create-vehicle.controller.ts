import { Controller, Post, Body, Ip, Headers } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreateVehicleRequestDto } from './dto/create-vehicle.request.dto';
import { CreateVehicleCommand } from '@vehicle/application/commands/v1/create-vehicle/create-vehicle.command';
import { matchResult } from '@common/http/match-result';
import { CreateVehicleResponseDto } from './dto/create-vehicle.response.dto';
import { CurrentUser, UserContext } from '@shared/infrastructure/decorators/current-user.decorator';

@ApiTags('Vehicle')
@Controller('v1/vehicle')
export class CreateVehicleController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('create')
  @ApiOperation({ summary: 'Registrar un nuevo vehículo' })
  @ApiResponse({ status: 201, description: 'Vehículo registrado exitosamente', type: CreateVehicleResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 409, description: 'La placa ya está registrada' })
  async execute(
    @Body() dto: CreateVehicleRequestDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @CurrentUser() user: UserContext,
  ) {
    const result = await this.commandBus.execute(
      new CreateVehicleCommand(
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

    return matchResult(
      result,
      (vehicle) => new CreateVehicleResponseDto(true, 'Vehículo registrado correctamente', vehicle),
      { ALREADY_EXISTS: 'La placa ya se encuentra registrada en el sistema' },
    );
  }
}
