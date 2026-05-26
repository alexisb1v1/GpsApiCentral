import { Controller, Get, Param, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GetVehicleRouteQuery } from '@vehicle/application/queries/v1/get-vehicle-route/get-vehicle-route.query';
import { GetVehicleRouteRequestDto } from './dto/get-vehicle-route.request.dto';
import { matchResult } from '@common/http/match-result';

@ApiTags('Vehicles')
@Controller('v1/vehicles')
export class GetVehicleRouteController {
  constructor(private readonly queryBus: QueryBus) { }

  @Get('route/:deviceId')
  @ApiOperation({ summary: 'Obtener el recorrido histórico de posiciones de un vehículo por su ID de Traccar' })
  @ApiResponse({ status: 200, description: 'Recorrido obtenido correctamente' })
  @ApiResponse({ status: 400, description: 'Parámetros de entrada inválidos' })
  @ApiResponse({ status: 500, description: 'Error al comunicarse con Traccar u otro fallo interno' })
  async execute(
    @Param('traccarDeviceId') traccarDeviceId: number,
    @Query() dto: GetVehicleRouteRequestDto,
  ) {
    const result = await this.queryBus.execute(
      new GetVehicleRouteQuery(
        traccarDeviceId,
        new Date(dto.from),
        new Date(dto.to),
      ),
    );
    return matchResult(result);
  }
}
