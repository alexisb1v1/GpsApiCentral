import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetDailyTicketsQuery } from '../get-daily-tickets.query';
import { DailyTicketRepository } from '@daily-ticket/domain/repositories/daily-ticket.repository';
import { Result } from 'neverthrow';
import { DailyTicketEntity } from '@daily-ticket/domain/entities/daily-ticket.entity';
import { AppError } from '@shared/domain/errors/app-errors';

@QueryHandler(GetDailyTicketsQuery)
export class GetDailyTicketsHandler implements IQueryHandler<GetDailyTicketsQuery> {
  constructor(
    @Inject('DailyTicketRepository')
    private readonly repository: DailyTicketRepository,
  ) {}

  async execute(query: GetDailyTicketsQuery): Promise<Result<DailyTicketEntity[], AppError>> {
    const todayStr = new Date().toISOString().split('T')[0];
    const dateToQuery = query.workDate || todayStr;
    return this.repository.findByTenantAndDate(query.tenantId, dateToQuery);
  }
}
