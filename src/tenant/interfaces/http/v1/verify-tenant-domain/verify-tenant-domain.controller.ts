import { Controller, Get, Query, Res, HttpStatus } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { VerifyTenantDomainQuery } from '@tenant/application/queries/v1/verify-tenant-domain/verify-tenant-domain.query';

@ApiTags('Tenant')
@Controller('v1/tenants')
export class VerifyTenantDomainController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('verify-domain')
  @ApiOperation({ summary: 'Verificar dominio para Caddy' })
  @ApiQuery({ name: 'domain', description: 'Dominio completo a verificar', example: 'losrapidos.centralafbv.com' })
  @ApiResponse({ status: 200, description: 'Dominio válido y activo' })
  @ApiResponse({ status: 404, description: 'Dominio no encontrado o inactivo' })
  @ApiResponse({ status: 400, description: 'Falta el parámetro domain' })
  async execute(@Query('domain') fullDomain: string, @Res() res: Response) {
    // 1. Si por alguna razón Caddy consulta sin dominio, rechazamos (400)
    if (!fullDomain) {
      return res.status(HttpStatus.BAD_REQUEST).send();
    }

    // 2. Llamamos al bus de consultas para ver si el dominio es válido
    // El handler se encarga de la extracción del subdominio y validación
    const result = await this.queryBus.execute(new VerifyTenantDomainQuery(fullDomain));

    // 3. Si es válido (existe y está activo), respondemos 200 OK. Caddy emite el SSL.
    if (result.isOk()) {
      return res.status(HttpStatus.OK).send();
    }

    // 4. Si es 'err()', evaluamos el tipo de error
    const error = result.error;

    // Si el tenant existe pero no está activo (según lógica del handler)
    if (error === 'FORBIDDEN') {
      return res.status(HttpStatus.FORBIDDEN).send(); // 403
    }

    // Para cualquier otro caso (NOT_FOUND, dominio mal formado, etc.)
    return res.status(HttpStatus.NOT_FOUND).send(); // 404
  }
}
