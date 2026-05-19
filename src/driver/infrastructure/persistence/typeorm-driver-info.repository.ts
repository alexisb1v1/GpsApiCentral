import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ok, err, Result } from 'neverthrow';
import { DriverInfoEntity } from '@driver/domain/entities/driver-info.entity';
import { DriverInfoRepository } from '@driver/domain/repositories/driver-info.repository';
import { AppError } from '@shared/domain/errors/app-errors';

@Injectable()
export class TypeOrmDriverInfoRepository implements DriverInfoRepository {
  constructor(
    @InjectRepository(DriverInfoEntity)
    private readonly repository: Repository<DriverInfoEntity>,
  ) {}

  async save(driverInfo: Partial<DriverInfoEntity>): Promise<Result<DriverInfoEntity, AppError>> {
    try {
      const saved = await this.repository.save(driverInfo);
      return ok(saved);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }

  async findById(id: string): Promise<Result<DriverInfoEntity, AppError>> {
    try {
      const driverInfo = await this.repository.findOne({ 
        where: { id },
        relations: ['user'],
      });
      if (!driverInfo) return err('NOT_FOUND');
      return ok(driverInfo);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }

  async findByDni(dni: string): Promise<Result<DriverInfoEntity, AppError>> {
    try {
      const driverInfo = await this.repository.findOne({ 
        where: { dni },
        relations: ['user'],
      });
      if (!driverInfo) return err('NOT_FOUND');
      return ok(driverInfo);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }

  async findByLicenseNumber(licenseNumber: string): Promise<Result<DriverInfoEntity, AppError>> {
    try {
      const driverInfo = await this.repository.findOne({ 
        where: { licenseNumber },
        relations: ['user'],
      });
      if (!driverInfo) return err('NOT_FOUND');
      return ok(driverInfo);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }
}
