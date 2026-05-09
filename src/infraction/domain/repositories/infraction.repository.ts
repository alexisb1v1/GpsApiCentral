import { InfractionEntity } from '../entities/infraction.entity';
import { Result } from 'neverthrow';
import { AppError } from '@shared/domain/errors/app-errors';

export interface InfractionRepository {
  save(infraction: InfractionEntity): Promise<Result<InfractionEntity, AppError>>;
  findById(id: string): Promise<Result<InfractionEntity, AppError>>;
  findByVehicleId(vehicleId: string): Promise<Result<InfractionEntity[], AppError>>;
}
