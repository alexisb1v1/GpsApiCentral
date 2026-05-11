import { Controller, Get, Param } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GetTenantBrandingQuery } from '@tenant/application/queries/v1/get-tenant-branding/get-tenant-branding.query';
import { TenantBrandingResponseDto } from '@tenant/application/queries/v1/get-tenant-branding/dto/tenant-branding.response.dto';
import { matchResult } from '@common/http/match-result';
import { Public } from '@shared/infrastructure/decorators/public.decorator';

@ApiTags('Tenants')
@Controller('v1/tenants')
export class GetTenantBrandingController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('branding/:subdomain')
  @Public() // Endpoint público para el login
  @ApiOperation({ summary: 'Obtener branding de la empresa por subdominio' })
  @ApiResponse({ status: 200, type: TenantBrandingResponseDto })
  @ApiResponse({ status: 404, description: 'Empresa no encontrada' })
  async execute(@Param('subdomain') subdomain: string) {
    const result = await this.queryBus.execute(new GetTenantBrandingQuery(subdomain));

    return matchResult(result);
  }
}
