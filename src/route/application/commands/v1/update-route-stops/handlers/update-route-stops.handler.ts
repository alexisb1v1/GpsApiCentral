import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { UpdateRouteStopsCommand } from '../update-route-stops.command';
import { RouteRepository } from '@route/domain/repositories/route.repository';
import { RouteStopEntity } from '@route/domain/entities/route-stop.entity';
import { AppError } from '@shared/domain/errors/app-errors';
import { AuditService } from '@shared/application/services/audit.service';
import { ITraccarProvider } from '@shared/infrastructure/traccar/traccar-provider.interface';
import { GeofenceRepository } from '@geofence/domain/repositories/geofence.repository';
import { GeofenceEntity, GeofenceType } from '@geofence/domain/entities/geofence.entity';

@CommandHandler(UpdateRouteStopsCommand)
export class UpdateRouteStopsHandler implements ICommandHandler<UpdateRouteStopsCommand> {
  constructor(
    @Inject('RouteRepository')
    private readonly routeRepository: RouteRepository,
    @Inject('GeofenceRepository')
    private readonly geofenceRepository: GeofenceRepository,
    @Inject('ITraccarProvider')
    private readonly traccarProvider: ITraccarProvider,
    private readonly auditService: AuditService,
  ) {}

  async execute(command: UpdateRouteStopsCommand): Promise<Result<void, AppError>> {
    // 1. Validar que la ruta existe y pertenece al tenant
    const routeResult = await this.routeRepository.findById(command.routeId);
    if (routeResult.isErr()) return err(routeResult.error);
    
    const route = routeResult.value;
    if (route.tenantId !== command.tenantId) {
      return err('UNAUTHORIZED');
    }

    // Actualizar nombre, estado y coordenadas si se envían
    let routeUpdated = false;
    if (command.name !== undefined) {
      route.name = command.name;
      routeUpdated = true;
    }
    if (command.isActive !== undefined) {
      route.isActive = command.isActive;
      routeUpdated = true;
    }
    if (command.coordinates !== undefined) {
      route.coordinates = command.coordinates;
      routeUpdated = true;
    }

    if (routeUpdated) {
      const saveRouteResult = await this.routeRepository.save(route);
      if (saveRouteResult.isErr()) return err(saveRouteResult.error);
    }

    // 2. Eliminar paraderos actuales
    await this.routeRepository.deleteStopsByRoute(command.routeId);

    // 3. Crear o actualizar paraderos y geocercas en Traccar y base de datos
    const newStops: RouteStopEntity[] = [];

    for (const dto of command.stops) {
      // 3.1. Determinar el tipo de geocerca basado en el orden
      let type = GeofenceType.CHECKPOINT;
      if (dto.stopOrder === 1) {
        type = GeofenceType.START;
      } else if (dto.stopOrder === command.stops.length) {
        type = GeofenceType.END;
      }

      const area = `CIRCLE (${dto.lat} ${dto.lng}, 80)`;
      let savedGeofence: GeofenceEntity;

      if (dto.geofenceId) {
        // --- MODO EDICIÓN ---
        // 3.2.1. Buscar la geocerca local existente
        const geofenceResult = await this.geofenceRepository.findById(dto.geofenceId);
        if (geofenceResult.isErr()) {
          return err(geofenceResult.error);
        }

        const geofence = geofenceResult.value;

        // 3.2.2. Actualizar la geocerca en Traccar
        const traccarResult = await this.traccarProvider.updateGeofence(geofence.traccarGeofenceId, {
          id: geofence.traccarGeofenceId,
          name: dto.name,
          description: `Punto de control (Actualizado) - ${routeResult.value.name}`,
          area,
          attributes: {
            color: type === GeofenceType.START ? '#28a745' : type === GeofenceType.END ? '#dc3545' : '#3b82f6',
          },
        });

        if (traccarResult.isErr()) {
          return err('INTERNAL_ERROR');
        }

        // 3.2.3. Actualizar la geocerca en nuestra base de datos local
        geofence.name = dto.name;
        geofence.type = type;

        const saveGeofenceResult = await this.geofenceRepository.save(geofence);
        if (saveGeofenceResult.isErr()) {
          return err(saveGeofenceResult.error);
        }

        savedGeofence = saveGeofenceResult.value;
      } else {
        // --- MODO CREACIÓN ---
        // 3.3.1. Crear geocerca en el API externa de Traccar
        const traccarResult = await this.traccarProvider.createGeofence({
          name: dto.name,
          description: `Punto de control - ${routeResult.value.name}`,
          area,
          attributes: {
            color: type === GeofenceType.START ? '#28a745' : type === GeofenceType.END ? '#dc3545' : '#3b82f6',
          },
        });

        if (traccarResult.isErr()) {
          return err('INTERNAL_ERROR');
        }

        const traccarGeofence = traccarResult.value;

        // 3.3.2. Crear y guardar la geocerca localmente
        const geofence = new GeofenceEntity();
        geofence.tenantId = command.tenantId;
        geofence.traccarGeofenceId = traccarGeofence.id!;
        geofence.name = dto.name;
        geofence.type = type;

        const saveGeofenceResult = await this.geofenceRepository.save(geofence);
        if (saveGeofenceResult.isErr()) {
          return err(saveGeofenceResult.error);
        }

        savedGeofence = saveGeofenceResult.value;
      }

      // 3.4. Crear la relación en route_stops
      const stop = new RouteStopEntity();
      stop.routeId = command.routeId;
      stop.geofenceId = savedGeofence.id;
      stop.stopOrder = dto.stopOrder;
      stop.minutesFromStart = dto.minutesFromStart;
      stop.coordinates = dto.polygonCoordinates; // Persistencia de la geometría del paradero
      newStops.push(stop);
    }

    // 4. Guardar todas las relaciones de paraderos en la base de datos
    const saveStopsResult = await this.routeRepository.saveStops(newStops);
    if (saveStopsResult.isErr()) return err(saveStopsResult.error);

    // 5. Auditoría
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
