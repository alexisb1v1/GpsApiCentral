import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { GetDailyTicketsQuery } from '@daily-ticket/application/queries/v1/get-daily-tickets/get-daily-tickets.query';
import { matchResult } from '@common/http/match-result';

@ApiTags('Daily Tickets')
@ApiBearerAuth()
@Controller('v1/daily-tickets')
export class GetDailyTicketsController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({ summary: 'Obtener el listado de tickets diarios del tenant' })
  async execute(
    @Req() req: any,
    @Query('workDate') workDate?: string,
  ) {
    const result = await this.queryBus.execute(
      new GetDailyTicketsQuery(req.user.tenantId, workDate),
    );
    return matchResult(result);
  }
}
