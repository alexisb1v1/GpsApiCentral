import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { GetGeofencesListQuery } from '../get-geofences-list.query';
import { GeofenceRepository } from '../../../../domain/repositories/geofence.repository';
import { GeofenceEntity } from '../../../../domain/entities/geofence.entity';
import { AppError } from '@shared/domain/errors/app-errors';

@QueryHandler(GetGeofencesListQuery)
export class GetGeofencesListHandler implements IQueryHandler<GetGeofencesListQuery> {
  constructor(
    @Inject('GeofenceRepository')
    private readonly geofenceRepository: GeofenceRepository,
  ) {}

  async execute(query: GetGeofencesListQuery): Promise<Result<GeofenceEntity[], AppError>> {
    return this.geofenceRepository.findAllByTenant(query.tenantId);
  }
}
