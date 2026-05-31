/* src/dashboard/interfaces/http/v1/get-dashboard-metrics.controller.ts */
import { Controller, Get, Req, UseGuards, Param, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { GetDashboardMetricsQuery } from '../../../application/queries/v1/get-dashboard-metrics.query';
import { VerifyTicketQuery } from '../../../application/queries/v1/verify-ticket.query';
import { Roles } from '@shared/infrastructure/decorators/roles.decorator';
import { RolesGuard } from '@shared/infrastructure/guards/roles.guard';
import { Public } from '@shared/infrastructure/decorators/public.decorator';

@ApiTags('Dashboard Metrics')
@ApiBearerAuth()
@Controller('v1/dashboard')
export class GetDashboardMetricsController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('metrics')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERATOR')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Obtener métricas consolidadas en tiempo real para el Dashboard Operativo' })
  @ApiResponse({ status: 200, description: 'Métricas cargadas exitosamente' })
  async getMetrics(@Req() req: any) {
    const tenantId = req.user.tenantId;
    const result = await this.queryBus.execute(
      new GetDashboardMetricsQuery(tenantId)
    );
    return result;
  }

  @Public()
  @Get('verify/:code')
  @ApiOperation({ summary: 'Verificar públicamente un ticket de salida o abono por su correlativo' })
  @ApiResponse({ status: 200, description: 'Verificación de ticket cargada con éxito' })
  async verifyTicket(
    @Param('code') code: string,
    @Query('subdomain') subdomain?: string,
  ) {
    const result = await this.queryBus.execute(
      new VerifyTicketQuery(code, subdomain)
    );
    return result;
  }
}
