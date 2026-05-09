import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Result } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { GetRoutesListQuery } from '../get-routes-list.query';
import { RouteRepository } from '../../../../domain/repositories/route.repository';
import { RouteEntity } from '../../../../domain/entities/route.entity';
import { AppError } from '@shared/domain/errors/app-errors';

@QueryHandler(GetRoutesListQuery)
export class GetRoutesListHandler implements IQueryHandler<GetRoutesListQuery> {
  constructor(
    @Inject('RouteRepository')
    private readonly routeRepository: RouteRepository,
  ) {}

  async execute(query: GetRoutesListQuery): Promise<Result<RouteEntity[], AppError>> {
    return this.routeRepository.findAllByTenant(query.tenantId);
  }
}
