import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { GetRouteDetailQuery } from '@route/application/queries/v1/get-route-detail/get-route-detail.query';
import { matchResult } from '@common/http/match-result';
import { CurrentUser, UserContext } from '@shared/infrastructure/decorators/current-user.decorator';
import { JwtAuthGuard } from '@shared/infrastructure/guards/jwt-auth.guard';

@ApiTags('Route (Gestión de Rutas)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/route')
export class GetRouteDetailController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('detail/:id')
  @ApiOperation({ summary: 'Obtener el detalle de una ruta con sus paraderos' })
  @ApiResponse({ status: 200, description: 'Detalle de la ruta' })
  async execute(@Param('id') id: string, @CurrentUser() user: UserContext) {
    const result = await this.queryBus.execute(
      new GetRouteDetailQuery(id, user.tenantId),
    );

    return matchResult(result, (route) => ({
      success: true,
      data: route,
    }));
  }
}
