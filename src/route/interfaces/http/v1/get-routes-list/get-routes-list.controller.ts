import { Controller, Get, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { GetRoutesListQuery } from '@route/application/queries/v1/get-routes-list/get-routes-list.query';
import { matchResult } from '@common/http/match-result';
import { CurrentUser, UserContext } from '@shared/infrastructure/decorators/current-user.decorator';
import { JwtAuthGuard } from '@shared/infrastructure/guards/jwt-auth.guard';

@ApiTags('Routes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/routes')
export class GetRoutesListController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('list')
  @ApiOperation({ summary: 'Obtener la lista de rutas del tenant' })
  @ApiResponse({ status: 200, description: 'Lista de rutas' })
  async execute(@CurrentUser() user: UserContext) {
    const result = await this.queryBus.execute(
      new GetRoutesListQuery(user.tenantId),
    );

    return matchResult(result, (routes) => ({
      success: true,
      data: routes,
    }));
  }
}
