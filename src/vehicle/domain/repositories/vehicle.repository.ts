import { Result } from 'neverthrow';
import { VehicleEntity } from '../entities/vehicle.entity';
import { AppError } from '@shared/domain/errors/app-errors';

export interface VehicleRepository {
  save(vehicle: Partial<VehicleEntity>): Promise<Result<VehicleEntity, AppError>>;
  findById(id: string): Promise<Result<VehicleEntity, AppError>>;
  findByPlate(plate: string): Promise<Result<VehicleEntity, AppError>>;
  findByTraccarId(traccarDeviceId: number): Promise<Result<VehicleEntity, AppError>>;
  findAllByTenant(tenantId?: string): Promise<Result<VehicleEntity[], AppError>>;
}
