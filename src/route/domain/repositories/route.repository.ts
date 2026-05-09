import { Result } from 'neverthrow';
import { RouteEntity } from '../entities/route.entity';
import { RouteStopEntity } from '../entities/route-stop.entity';
import { AppError } from '@shared/domain/errors/app-errors';

export interface RouteRepository {
  save(route: RouteEntity): Promise<Result<RouteEntity, AppError>>;
  findById(id: string): Promise<Result<RouteEntity, AppError>>;
  findAllByTenant(tenantId: string): Promise<Result<RouteEntity[], AppError>>;
  delete(id: string): Promise<Result<boolean, AppError>>;
  
  // Gestión de Paraderos
  saveStops(stops: RouteStopEntity[]): Promise<Result<RouteStopEntity[], AppError>>;
  deleteStopsByRoute(routeId: string): Promise<Result<void, AppError>>;
}
