import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ok, err, Result } from 'neverthrow';
import { VehicleEntity } from '@vehicle/domain/entities/vehicle.entity';
import { VehicleRepository } from '@vehicle/domain/repositories/vehicle.repository';
import { AppError } from '@shared/domain/errors/app-errors';

@Injectable()
export class TypeOrmVehicleRepository implements VehicleRepository {
  constructor(
    @InjectRepository(VehicleEntity)
    private readonly repository: Repository<VehicleEntity>,
  ) {}

  async save(vehicle: Partial<VehicleEntity>): Promise<Result<VehicleEntity, AppError>> {
    try {
      const savedVehicle = await this.repository.save(vehicle);
      return ok(savedVehicle);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }

  async findById(id: string): Promise<Result<VehicleEntity, AppError>> {
    try {
      const vehicle = await this.repository.findOne({ where: { id } });
      if (!vehicle) return err('NOT_FOUND');
      return ok(vehicle);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }

  async findByPlate(plate: string): Promise<Result<VehicleEntity, AppError>> {
    try {
      const vehicle = await this.repository.findOne({ where: { plate } });
      if (!vehicle) return err('NOT_FOUND');
      return ok(vehicle);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }

  async findByTraccarId(traccarDeviceId: string): Promise<Result<VehicleEntity, AppError>> {
    try {
      const vehicle = await this.repository.findOne({ where: { traccarDeviceId } });
      if (!vehicle) return err('NOT_FOUND');
      return ok(vehicle);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }

  async findAllByTenant(tenantId: string): Promise<Result<VehicleEntity[], AppError>> {
    try {
      const vehicles = await this.repository.find({ where: { tenantId } });
      return ok(vehicles);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }
}
