import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Result, err, ok } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { GetRouteDetailQuery } from '../get-route-detail.query';
import { RouteRepository } from '@route/domain/repositories/route.repository';
import { RouteEntity } from '@route/domain/entities/route.entity';
import { AppError } from '@shared/domain/errors/app-errors';

@QueryHandler(GetRouteDetailQuery)
export class GetRouteDetailHandler implements IQueryHandler<GetRouteDetailQuery> {
  constructor(
    @Inject('RouteRepository')
    private readonly routeRepository: RouteRepository,
  ) {}

  async execute(query: GetRouteDetailQuery): Promise<Result<RouteEntity, AppError>> {
    const result = await this.routeRepository.findById(query.id);
    if (result.isErr()) return err(result.error);
    
    if (result.value.tenantId !== query.tenantId) {
      return err('UNAUTHORIZED');
    }

    return ok(result.value);
  }
}
