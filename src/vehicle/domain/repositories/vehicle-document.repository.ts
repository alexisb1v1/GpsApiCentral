import { Result } from 'neverthrow';
import { VehicleDocumentEntity } from '../entities/vehicle-document.entity';
import { AppError } from '@shared/domain/errors/app-errors';

export interface VehicleDocumentRepository {
  save(document: Partial<VehicleDocumentEntity>): Promise<Result<VehicleDocumentEntity, AppError>>;
  findById(id: string): Promise<Result<VehicleDocumentEntity, AppError>>;
  findByVehicleId(vehicleId: string): Promise<Result<VehicleDocumentEntity[], AppError>>;
  delete(id: string): Promise<Result<void, AppError>>;
}
