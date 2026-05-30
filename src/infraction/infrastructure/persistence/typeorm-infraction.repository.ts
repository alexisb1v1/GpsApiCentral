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
      return err('INTERNAL_ERROR');
    }
  }

  async findById(id: string): Promise<Result<InfractionEntity, AppError>> {
    try {
      const infraction = await this.repository.findOne({ where: { id } });
      if (!infraction) {
        return err('NOT_FOUND');
      }
      return ok(infraction);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }

  async findByVehicleId(vehicleId: string): Promise<Result<InfractionEntity[], AppError>> {
    try {
      const infractions = await this.repository.find({ where: { vehicleId } });
      return ok(infractions);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }

  async findFiltered(filters: {
    tenantId?: string;
    driverId?: string;
    date?: string;
  }): Promise<Result<InfractionEntity[], AppError>> {
    try {
      const queryBuilder = this.repository.createQueryBuilder('infraction')
        .leftJoinAndSelect('infraction.vehicle', 'vehicle')
        .leftJoinAndSelect('infraction.payment', 'payment');

      if (filters.tenantId) {
        queryBuilder.andWhere('infraction.tenantId = :tenantId', { tenantId: filters.tenantId });
      }

      if (filters.driverId) {
        queryBuilder.andWhere('infraction.userId = :driverId', { driverId: filters.driverId });
      }

      if (filters.date) {
        const startDate = `${filters.date} 00:00:00`;
        const endDate = `${filters.date} 23:59:59`;
        queryBuilder.andWhere('infraction.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate });
      }

      queryBuilder.orderBy('infraction.createdAt', 'DESC');

      const infractions = await queryBuilder.getMany();
      return ok(infractions);
    } catch (error) {
      console.error('Error in findFiltered:', error);
      return err('INTERNAL_ERROR');
    }
  }
}
