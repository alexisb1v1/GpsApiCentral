import { Result } from 'neverthrow';
import { DriverInfoEntity } from '../entities/driver-info.entity';
import { AppError } from '@shared/domain/errors/app-errors';

export interface DriverInfoRepository {
  save(driverInfo: Partial<DriverInfoEntity>): Promise<Result<DriverInfoEntity, AppError>>;
  findById(id: string): Promise<Result<DriverInfoEntity, AppError>>;
  findByDni(dni: string): Promise<Result<DriverInfoEntity, AppError>>;
  findByLicenseNumber(licenseNumber: string): Promise<Result<DriverInfoEntity, AppError>>;
}
