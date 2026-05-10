import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { UpdateRouteStopsCommand } from '../update-route-stops.command';
import { RouteRepository } from '@route/domain/repositories/route.repository';
import { RouteStopEntity } from '@route/domain/entities/route-stop.entity';
import { AppError } from '@shared/domain/errors/app-errors';
import { AuditService } from '@shared/application/services/audit.service';

@CommandHandler(UpdateRouteStopsCommand)
export class UpdateRouteStopsHandler implements ICommandHandler<UpdateRouteStopsCommand> {
  constructor(
    @Inject('RouteRepository')
    private readonly routeRepository: RouteRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(command: UpdateRouteStopsCommand): Promise<Result<void, AppError>> {
    // 1. Validar que la ruta existe y pertenece al tenant
    const routeResult = await this.routeRepository.findById(command.routeId);
    if (routeResult.isErr()) return err(routeResult.error);
    
    if (routeResult.value.tenantId !== command.tenantId) {
      return err('UNAUTHORIZED');
    }

    // 2. Eliminar paraderos actuales
    await this.routeRepository.deleteStopsByRoute(command.routeId);

    // 3. Crear nuevos paraderos
    const newStops = command.stops.map((dto) => {
      const stop = new RouteStopEntity();
      stop.routeId = command.routeId;
      stop.geofenceId = dto.geofenceId;
      stop.stopOrder = dto.stopOrder;
      stop.minutesFromStart = dto.minutesFromStart;
      return stop;
    });

    const saveStopsResult = await this.routeRepository.saveStops(newStops);
    if (saveStopsResult.isErr()) return err(saveStopsResult.error);

    // 4. Auditoría
    this.auditService.createLog({
      tenantId: command.tenantId,
      userId: command.userId,
      action: 'UPDATE_ROUTE_STOPS',
      entityName: 'routes',
      entityId: command.routeId,
      newValues: { stops: newStops },
      ipAddress: command.ipAddress,
      userAgent: command.userAgent,
    });

    return ok(undefined);
  }
}
