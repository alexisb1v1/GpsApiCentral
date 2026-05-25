import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { UpdateRouteStopsCommand } from '../update-route-stops.command';
import { RouteRepository } from '@route/domain/repositories/route.repository';
import { RouteStopEntity } from '@route/domain/entities/route-stop.entity';
import { AppError } from '@shared/domain/errors/app-errors';
import { AuditService } from '@shared/application/services/audit.service';
import { ITraccarProvider } from '@shared/infrastructure/traccar/traccar-provider.interface';

export enum GeofenceType {
  START = 'START',
  CHECKPOINT = 'CHECKPOINT',
  END = 'END',
}

@CommandHandler(UpdateRouteStopsCommand)
export class UpdateRouteStopsHandler implements ICommandHandler<UpdateRouteStopsCommand> {
  constructor(
    @Inject('RouteRepository')
    private readonly routeRepository: RouteRepository,
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
      if (command.direction === 'IDA') {
        route.outboundCoordinates = command.coordinates;
      } else {
        route.inboundCoordinates = command.coordinates;
      }
      routeUpdated = true;
    }

    // Si traccarGroupId es nulo, undefined o 0, creamos el grupo en Traccar
    if (!route.traccarGroupId || route.traccarGroupId === 0) {
      const traccarResult = await this.traccarProvider.createGroup({
        name: route.name,
      });

      if (traccarResult.isErr()) {
        return err('TRACCAR_API_ERROR');
      }

      const traccarGroup = traccarResult.value;
      route.traccarGroupId = traccarGroup.id;
      routeUpdated = true;
    }

    if (routeUpdated) {
      const saveRouteResult = await this.routeRepository.save(route);
      if (saveRouteResult.isErr()) return err(saveRouteResult.error);
    }

    // 2. Eliminar paraderos actuales de la dirección correspondiente
    await this.routeRepository.deleteStopsByRoute(command.routeId, command.direction);

    // 2.5. Obtener geocercas vinculadas al grupo de la ruta actualmente en Traccar para evitar re-vincularlas
    let existingGroupGeofenceIds: number[] = [];
    if (route.traccarGroupId && route.traccarGroupId !== 0) {
      const existingGeofencesResult = await this.traccarProvider.getGeofences(route.traccarGroupId);
      if (existingGeofencesResult.isOk()) {
        existingGroupGeofenceIds = existingGeofencesResult.value
          .map(g => g.id!)
          .filter(id => id !== undefined);
      }
    }

    // 3. Crear o actualizar paraderos en Traccar y base de datos
    const newStops: RouteStopEntity[] = [];

    for (const dto of command.stops) {
      // 3.1. Determinar el tipo de geocerca basado en el orden
      let type: 'START' | 'CHECKPOINT' | 'END' = 'CHECKPOINT';
      if (dto.stopOrder === 1) {
        type = 'START';
      } else if (dto.stopOrder === command.stops.length) {
        type = 'END';
      }

      const area = `CIRCLE (${dto.lat} ${dto.lng}, 80)`;
      let finalTraccarGeofenceId: number;

      if (dto.traccarGeofenceId) {
        // --- MODO EDICIÓN ---
        // 3.2.1. Actualizar la geocerca en Traccar
        const traccarResult = await this.traccarProvider.updateGeofence(dto.traccarGeofenceId, {
          id: dto.traccarGeofenceId,
          name: dto.name,
          description: `Punto de control (Actualizado) - ${routeResult.value.name}`,
          area,
          attributes: {
            color: type === 'START' ? '#28a745' : type === 'END' ? '#dc3545' : '#3b82f6',
          },
        });

        if (traccarResult.isErr()) {
          return err('TRACCAR_API_ERROR');
        }

        finalTraccarGeofenceId = dto.traccarGeofenceId;
      } else {
        // --- MODO CREACIÓN ---
        // 3.3.1. Crear geocerca en el API externa de Traccar
        const traccarResult = await this.traccarProvider.createGeofence({
          name: dto.name,
          description: `Punto de control - ${routeResult.value.name}`,
          area,
          attributes: {
            color: type === 'START' ? '#28a745' : type === 'END' ? '#dc3545' : '#3b82f6',
          },
        });

        if (traccarResult.isErr()) {
          return err('TRACCAR_API_ERROR');
        }

        const traccarGeofence = traccarResult.value;
        finalTraccarGeofenceId = traccarGeofence.id!;
      }

      // 3.3.2. Sincronizar permisos (vincular geocerca con el grupo en Traccar si no está asociada)
      if (route.traccarGroupId && route.traccarGroupId !== 0) {
        const isAlreadyLinked = existingGroupGeofenceIds.includes(finalTraccarGeofenceId);
        if (!isAlreadyLinked) {
          const linkResult = await this.traccarProvider.linkGeofenceToGroup(route.traccarGroupId, finalTraccarGeofenceId);
          if (linkResult.isErr()) {
            return err('TRACCAR_API_ERROR');
          }
        }
      }

      // 3.4. Crear la parada en route_stops
      const stop = new RouteStopEntity();
      stop.routeId = command.routeId;
      stop.traccarGeofenceId = finalTraccarGeofenceId;
      stop.type = type;
      stop.name = dto.name;
      stop.stopOrder = dto.stopOrder;
      stop.minutesFromStart = dto.minutesFromStart;
      stop.direction = command.direction;
      stop.coordinates = dto.polygonCoordinates; // Persistencia de la geometría del paradero
      newStops.push(stop);
    }

    // 4. Guardar todas las paradas en la base de datos
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
