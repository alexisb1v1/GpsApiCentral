import { Controller, Get, Param } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GetVehicleByIdQuery } from '@vehicle/application/queries/v1/get-vehicle-by-id/get-vehicle-by-id.query';
import { matchResult } from '@common/http/match-result';

@ApiTags('Vehicles')
@Controller('v1/vehicles')
export class GetVehicleByIdController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un vehículo por su ID' })
  @ApiResponse({ status: 200, description: 'Vehículo encontrado' })
  @ApiResponse({ status: 404, description: 'Vehículo no encontrado' })
  async execute(@Param('id') id: string) {
    const result = await this.queryBus.execute(new GetVehicleByIdQuery(id));
    return matchResult(result);
  }
}
