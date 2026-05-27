import { Controller, Get, Query, Req } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { GetInfractionsQuery } from '@infraction/application/queries/v1/get-infractions/get-infractions.query';
import { matchResult } from '@common/http/match-result';

@ApiTags('Infractions')
@ApiBearerAuth()
@Controller('v1/infractions')
export class GetInfractionsController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({ summary: 'Obtener listado de infracciones filtrado por roles' })
  @ApiQuery({ name: 'tenantId', required: false, type: String })
  @ApiQuery({ name: 'driverId', required: false, type: String })
  @ApiQuery({ name: 'date', required: false, type: String, description: 'Fecha en formato YYYY-MM-DD' })
  async execute(
    @Req() req: any,
    @Query('tenantId') tenantId?: string,
    @Query('driverId') driverId?: string,
    @Query('date') date?: string,
  ) {
    const user = req.user;
    const role = user?.role;

    // Sanitización defensiva contra literales de texto "undefined" o "null"
    const cleanTenantId = (tenantId && tenantId !== 'undefined' && tenantId !== 'null') ? tenantId : undefined;
    const cleanDriverId = (driverId && driverId !== 'undefined' && driverId !== 'null') ? driverId : undefined;
    const cleanDate = (date && date !== 'undefined' && date !== 'null') ? date : undefined;

    let targetTenantId: string | undefined = cleanTenantId;
    let targetDriverId: string | undefined = cleanDriverId;

    if (role === 'SUPER_ADMIN') {
      targetTenantId = cleanTenantId;
      targetDriverId = cleanDriverId;
    } else if (role === 'ADMIN' || role === 'OPERATOR') {
      targetTenantId = user.tenantId;
      targetDriverId = cleanDriverId;
    } else if (role === 'DRIVER') {
      targetTenantId = user.tenantId;
      targetDriverId = user.sub;
    } else {
      targetTenantId = '00000000-0000-0000-0000-000000000000';
      targetDriverId = '00000000-0000-0000-0000-000000000000';
    }

    const result = await this.queryBus.execute(
      new GetInfractionsQuery(targetTenantId, targetDriverId, cleanDate),
    );

    return matchResult(result);
  }
}
