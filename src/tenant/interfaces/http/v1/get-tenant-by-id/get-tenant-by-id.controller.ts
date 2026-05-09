import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GetTenantByIdQuery } from '@tenant/application/queries/v1/get-tenant-by-id/get-tenant-by-id.query';
import { matchResult } from '@common/http/match-result';
import { CreateTenantResponseDto } from '@tenant/interfaces/http/v1/create-tenant/dto/create-tenant.response.dto';

@ApiTags('Tenant')
@Controller('v1/tenant')
export class GetTenantByIdController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':id')
  @ApiOperation({ summary: 'Obtener empresa por ID' })
  @ApiResponse({ status: 200, type: CreateTenantResponseDto })
  @ApiResponse({ status: 404, description: 'Empresa no encontrada' })
  async execute(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.queryBus.execute(new GetTenantByIdQuery(id));

    return matchResult(
      result,
      (tenant) => new CreateTenantResponseDto(tenant)
    );
  }
}
