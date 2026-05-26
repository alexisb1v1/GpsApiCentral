import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ok, err, Result } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { GetVehicleRouteQuery } from '../get-vehicle-route.query';
import { ITraccarProvider } from '@shared/infrastructure/traccar/traccar-provider.interface';
import { AppError } from '@shared/domain/errors/app-errors';

@QueryHandler(GetVehicleRouteQuery)
export class GetVehicleRouteHandler implements IQueryHandler<GetVehicleRouteQuery> {
  constructor(
    @Inject('ITraccarProvider')
    private readonly traccarProvider: ITraccarProvider,
  ) { }

  /**
   * Obtiene el recorrido histórico de posiciones de un dispositivo directamente de Traccar.
   *
   * @param query - Parámetros de la query:
   *   - `deviceId`: ID numérico del dispositivo en Traccar
   *   - `from`: Fecha y hora de inicio (Date)
   *   - `to`: Fecha y hora de fin (Date)
   *
   * @returns Array de posiciones GPS en formato JSON
   *
   * @throws `TRACCAR_API_ERROR` si hay un fallo al comunicarse con el servidor de Traccar
   */
  async execute(query: GetVehicleRouteQuery): Promise<Result<any[], AppError>> {
    const positionsResult = await this.traccarProvider.getDevicePositions(
      query.traccarDeviceId,
      query.from,
      query.to,
    );

    if (positionsResult.isErr()) {
      return err('TRACCAR_API_ERROR');
    }

    return ok(positionsResult.value);
  }
}
