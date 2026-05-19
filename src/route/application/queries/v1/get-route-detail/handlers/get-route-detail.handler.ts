import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Result, err, ok } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { GetRouteDetailQuery } from '../get-route-detail.query';
import { RouteRepository } from '@route/domain/repositories/route.repository';
import { RouteEntity } from '@route/domain/entities/route.entity';
import { AppError } from '@shared/domain/errors/app-errors';
import { ITraccarProvider } from '@shared/infrastructure/traccar/traccar-provider.interface';

@QueryHandler(GetRouteDetailQuery)
export class GetRouteDetailHandler implements IQueryHandler<GetRouteDetailQuery> {
  constructor(
    @Inject('RouteRepository')
    private readonly routeRepository: RouteRepository,
    @Inject('ITraccarProvider')
    private readonly traccarProvider: ITraccarProvider,
  ) {}

  async execute(query: GetRouteDetailQuery): Promise<Result<RouteEntity, AppError>> {
    const result = await this.routeRepository.findById(query.id);
    if (result.isErr()) return err(result.error);
    
    const route = result.value;
    if (route.tenantId !== query.tenantId) {
      return err('UNAUTHORIZED');
    }

    // Obtener geocercas desde Traccar para mapear lat/lng dinámicamente
    const traccarGeofencesResult = await this.traccarProvider.getGeofences();
    if (traccarGeofencesResult.isOk()) {
      const traccarGeofences = traccarGeofencesResult.value;
      
      // Mapear lat/lng a cada parada usando traccarGeofenceId
      for (const stop of route.stops) {
        if (stop.geofence && stop.geofence.traccarGeofenceId) {
          const match = traccarGeofences.find(g => g.id === stop.geofence.traccarGeofenceId);
          if (match && match.area) {
            // Parsear CIRCLE (-8.3791 -74.5321, 80) o similar
            const matchCoordinates = match.area.match(/CIRCLE\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\)/i);
            if (matchCoordinates) {
              stop.geofence.lat = parseFloat(matchCoordinates[1]);
              stop.geofence.lng = parseFloat(matchCoordinates[2]);
            }
          }
        }
      }
    }

    return ok(route);
  }
}
