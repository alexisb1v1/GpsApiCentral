import { Controller, Get, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { GetDriversListQuery } from '@driver/application/queries/v1/get-drivers-list/get-drivers-list.query';
import { matchResult } from '@common/http/match-result';
import { CreateDriverResponseDto } from '../create-driver/dto/create-driver.response.dto';
import { UserEntity } from '@user/domain/entities/user.entity';

@ApiTags('Drivers')
@ApiBearerAuth()
@Controller('v1/drivers')
export class GetDriversListController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({ summary: 'Listar todos los choferes o por Tenant' })
  @ApiQuery({ name: 'tenantId', required: false, description: 'ID del Tenant para filtrar' })
  @ApiResponse({ status: 200, type: [CreateDriverResponseDto] })
  async execute(@Query('tenantId') tenantId?: string) {
    const result = await this.queryBus.execute(new GetDriversListQuery(tenantId));

    return matchResult(
      result,
      (drivers: UserEntity[]) => drivers.map((d) => new CreateDriverResponseDto(d))
    );
  }
}
