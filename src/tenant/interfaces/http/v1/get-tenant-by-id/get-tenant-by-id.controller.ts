import { Controller, Get, Param, ParseUUIDPipe, Query, Res, HttpStatus } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { GetTenantByIdQuery } from '@tenant/application/queries/v1/get-tenant-by-id/get-tenant-by-id.query';
import { matchResult } from '@common/http/match-result';
import { CreateTenantResponseDto } from '@tenant/interfaces/http/v1/create-tenant/dto/create-tenant.response.dto';
import { Public } from '@shared/infrastructure/decorators/public.decorator';
import { Response } from 'express';
import { VerifyTenantDomainQuery } from '@tenant/application/queries/v1/verify-tenant-domain/verify-tenant-domain.query';

@ApiTags('Tenant')
@Controller('v1/tenants')
export class GetTenantByIdController {
  constructor(private readonly queryBus: QueryBus) {}

  @Public()
  @Get('verify-domain')
  @ApiOperation({ summary: 'Verificar dominio para Caddy' })
  @ApiQuery({ name: 'domain', description: 'Dominio completo a verificar' })
  async verifyDomain(@Query('domain') fullDomain: string, @Res() res: Response) {
    if (!fullDomain) {
      return res.status(HttpStatus.BAD_REQUEST).send();
    }
    const result = await this.queryBus.execute(new VerifyTenantDomainQuery(fullDomain));
    if (result.isOk()) {
      return res.status(HttpStatus.OK).send();
    }
    return res.status(HttpStatus.NOT_FOUND).send();
  }

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
