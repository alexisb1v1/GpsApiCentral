import { Controller, Get, Param } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { GetDriverByIdQuery } from '@driver/application/queries/v1/get-driver-by-id/get-driver-by-id.query';
import { matchResult } from '@common/http/match-result';
import { CreateDriverResponseDto } from '../create-driver/dto/create-driver.response.dto';

@ApiTags('Drivers')
@ApiBearerAuth()
@Controller('v1/drivers')
export class GetDriverByIdController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un chofer por su ID de usuario' })
  @ApiParam({ name: 'id', description: 'ID de usuario del chofer' })
  @ApiResponse({ status: 200, type: CreateDriverResponseDto })
  async execute(@Param('id') id: string) {
    const result = await this.queryBus.execute(new GetDriverByIdQuery(id));

    return matchResult(result, (data) => new CreateDriverResponseDto(data));
  }
}
