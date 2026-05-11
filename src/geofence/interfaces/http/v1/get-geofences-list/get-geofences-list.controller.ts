import { Controller, Get, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { GetGeofencesListQuery } from '@geofence/application/queries/v1/get-geofences-list/get-geofences-list.query';
import { matchResult } from '@common/http/match-result';
import { CurrentUser, UserContext } from '@shared/infrastructure/decorators/current-user.decorator';
import { JwtAuthGuard } from '@shared/infrastructure/guards/jwt-auth.guard';

@ApiTags('Geofence (Puntos de Control)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/geofence')
export class GetGeofencesListController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('list')
  @ApiOperation({ summary: 'Obtener lista de puntos de control / paraderos' })
  @ApiResponse({ status: 200, description: 'Lista obtenida correctamente' })
  async execute(@CurrentUser() user: UserContext) {
    const result = await this.queryBus.execute(new GetGeofencesListQuery(user.tenantId));

    return matchResult(result);
  }
}
