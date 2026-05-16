import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ok, err, Result } from 'neverthrow';
import { VehicleDocumentEntity } from '@vehicle/domain/entities/vehicle-document.entity';
import { VehicleDocumentRepository } from '@vehicle/domain/repositories/vehicle-document.repository';
import { AppError } from '@shared/domain/errors/app-errors';

@Injectable()
export class TypeOrmVehicleDocumentRepository implements VehicleDocumentRepository {
  constructor(
    @InjectRepository(VehicleDocumentEntity)
    private readonly repository: Repository<VehicleDocumentEntity>,
  ) {}

  async save(document: Partial<VehicleDocumentEntity>): Promise<Result<VehicleDocumentEntity, AppError>> {
    try {
      const saved = await this.repository.save(document);
      return ok(saved);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }

  async findById(id: string): Promise<Result<VehicleDocumentEntity, AppError>> {
    try {
      const document = await this.repository.findOne({ where: { id } });
      if (!document) return err('NOT_FOUND');
      return ok(document);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }

  async findByVehicleId(vehicleId: string): Promise<Result<VehicleDocumentEntity[], AppError>> {
    try {
      const documents = await this.repository.find({ where: { vehicleId } });
      return ok(documents);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }

  async delete(id: string): Promise<Result<void, AppError>> {
    try {
      const result = await this.repository.delete(id);
      if (result.affected === 0) return err('NOT_FOUND');
      return ok(undefined);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }
}
