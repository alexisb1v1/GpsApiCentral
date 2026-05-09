import { RouteStopItemDto } from '../../../../interfaces/http/v1/update-route-stops/dto/update-route-stops.request.dto';

export class UpdateRouteStopsCommand {
  constructor(
    public readonly routeId: string,
    public readonly stops: RouteStopItemDto[],
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly ipAddress: string,
    public readonly userAgent: string,
  ) {}
}
