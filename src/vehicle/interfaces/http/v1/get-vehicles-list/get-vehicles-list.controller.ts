import { Controller, Get, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GetVehiclesListQuery } from '@vehicle/application/queries/v1/get-vehicles-list/get-vehicles-list.query';
import { matchResult } from '@common/http/match-result';

@ApiTags('Vehicle')
@Controller('v1/vehicle')
export class GetVehiclesListController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('list')
  @ApiOperation({ summary: 'Obtener listado de vehículos de un tenant' })
  @ApiResponse({ status: 200, description: 'Listado de vehículos' })
  async execute(@Query('tenantId') tenantId: string) {
    const result = await this.queryBus.execute(new GetVehiclesListQuery(tenantId));
    return matchResult(result, (vehicles) => ({
      success: true,
      message: 'Listado de vehículos obtenido correctamente',
      data: vehicles,
    }));
  }
}
