import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetInfractionsQuery } from './get-infractions.query';
import { InfractionRepository } from '@infraction/domain/repositories/infraction.repository';
import { Result } from 'neverthrow';
import { InfractionEntity } from '@infraction/domain/entities/infraction.entity';
import { AppError } from '@shared/domain/errors/app-errors';

@QueryHandler(GetInfractionsQuery)
export class GetInfractionsHandler implements IQueryHandler<GetInfractionsQuery> {
  constructor(
    @Inject('InfractionRepository')
    private readonly repository: InfractionRepository,
  ) {}

  async execute(query: GetInfractionsQuery): Promise<Result<InfractionEntity[], AppError>> {
    return this.repository.findFiltered({
      tenantId: query.tenantId,
      driverId: query.driverId,
      date: query.date,
    });
  }
}
