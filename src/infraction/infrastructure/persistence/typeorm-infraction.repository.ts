import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Result, ok, err } from 'neverthrow';
import { InfractionEntity } from '@infraction/domain/entities/infraction.entity';
import { InfractionRepository } from '@infraction/domain/repositories/infraction.repository';
import { AppError } from '@shared/domain/errors/app-errors';

@Injectable()
export class TypeOrmInfractionRepository implements InfractionRepository {
  constructor(
    @InjectRepository(InfractionEntity)
    private readonly repository: Repository<InfractionEntity>,
  ) {}

  async save(infraction: InfractionEntity): Promise<Result<InfractionEntity, AppError>> {
    try {
      const saved = await this.repository.save(infraction);
      return ok(saved);
    } catch (error) {
      return err({
        code: 'DATABASE_ERROR',
        message: 'Error al guardar la infracción',
        details: error.message,
      } as AppError);
    }
  }

  async findById(id: string): Promise<Result<InfractionEntity, AppError>> {
    try {
      const infraction = await this.repository.findOne({ where: { id } });
      if (!infraction) {
        return err({
          code: 'NOT_FOUND',
          message: 'Infracción no encontrada',
        } as AppError);
      }
      return ok(infraction);
    } catch (error) {
      return err({
        code: 'DATABASE_ERROR',
        message: 'Error al buscar la infracción',
        details: error.message,
      } as AppError);
    }
  }

  async findByVehicleId(vehicleId: string): Promise<Result<InfractionEntity[], AppError>> {
    try {
      const infractions = await this.repository.find({ where: { vehicleId } });
      return ok(infractions);
    } catch (error) {
      return err({
        code: 'DATABASE_ERROR',
        message: 'Error al buscar infracciones del vehículo',
        details: error.message,
      } as AppError);
    }
  }
}
