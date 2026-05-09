import { Result } from 'neverthrow';
import { GeofenceEntity } from '../entities/geofence.entity';
import { AppError } from '@shared/domain/errors/app-errors';

export interface GeofenceRepository {
  save(geofence: GeofenceEntity): Promise<Result<GeofenceEntity, AppError>>;
  findById(id: string): Promise<Result<GeofenceEntity, AppError>>;
  findAllByTenant(tenantId: string): Promise<Result<GeofenceEntity[], AppError>>;
  delete(id: string): Promise<Result<boolean, AppError>>;
  findByTraccarId(tenantId: string, traccarGeofenceId: number): Promise<Result<GeofenceEntity | null, AppError>>;
}
