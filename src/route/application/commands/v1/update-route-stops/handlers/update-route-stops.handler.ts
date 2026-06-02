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

    // Si la ruta se está desactivando (isActive === false)
    if (command.isActive === false) {
      // 1. Eliminar geocercas en Traccar para todos los paraderos asociados
      if (route.stops && route.stops.length > 0) {
        for (const stop of route.stops) {
          if (stop.traccarGeofenceId) {
            await this.traccarProvider.deleteGeofence(stop.traccarGeofenceId);
          }
        }
      }
      
      // 2. Eliminar el grupo en Traccar
      if (route.traccarGroupId && route.traccarGroupId !== 0) {
        await this.traccarProvider.deleteGroup(route.traccarGroupId);
        route.traccarGroupId = 0;
      }

      route.isActive = false;

      // 3. Eliminar paraderos locales también
      await this.routeRepository.deleteStopsByRoute(command.routeId);

      const saveRouteResult = await this.routeRepository.save(route);
      if (saveRouteResult.isErr()) return err(saveRouteResult.error);

      // 4. Auditoría
      this.auditService.createLog({
        tenantId: command.tenantId,
        userId: command.userId,
        action: 'DEACTIVATE_ROUTE',
        entityName: 'routes',
        entityId: command.routeId,
        newValues: route,
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
      });

      return ok(undefined);
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

    // Si traccarGroupId es nulo, undefined o 0, creamos el grupo en Traccar (solo si la ruta está activa)
    if (route.isActive && (!route.traccarGroupId || route.traccarGroupId === 0)) {
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

      // Determinar la geometría de la geocerca (WKT)
      let area: string;
      if (dto.polygonCoordinates && dto.polygonCoordinates.length >= 3) {
        const coords = [...dto.polygonCoordinates];
        // Asegurar que el polígono esté cerrado (primer punto idéntico al último)
        const first = coords[0];
        const last = coords[coords.length - 1];
        if (first.lat !== last.lat || first.lng !== last.lng) {
          coords.push(first);
        }
        // WKT especifica Longitud (lng) primero y Latitud (lat) después
        const wktPoints = coords.map(c => `${c.lng} ${c.lat}`).join(', ');
        area = `POLYGON ((${wktPoints}))`;
      } else {
        // Círculo con radio dinámico (dto.radius) o 5 metros por defecto
        const radius = dto.radius || 5;
        area = `CIRCLE (${dto.lat} ${dto.lng}, ${radius})`;
      }
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
