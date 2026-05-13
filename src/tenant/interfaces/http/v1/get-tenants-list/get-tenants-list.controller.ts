import { Controller, Get } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GetTenantsListQuery } from '@tenant/application/queries/v1/get-tenants-list/get-tenants-list.query';
import { matchResult } from '@common/http/match-result';
import { CreateTenantResponseDto } from '@tenant/interfaces/http/v1/create-tenant/dto/create-tenant.response.dto';
import { TenantEntity } from '@tenant/domain/entities/tenant.entity';

@ApiTags('Tenant')
@Controller('v1/tenants')
export class GetTenantsListController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({ summary: 'Obtener lista de todas las empresas' })
  @ApiResponse({ status: 200, type: [CreateTenantResponseDto] })
  async execute() {
    const result = await this.queryBus.execute(new GetTenantsListQuery());

    return matchResult(
      result,
      (tenants: TenantEntity[]) => tenants.map((tenant) => new CreateTenantResponseDto(tenant))
    );
  }
}
