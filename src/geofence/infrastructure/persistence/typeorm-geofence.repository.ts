import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Result, ok, err } from 'neverthrow';
import { GeofenceEntity } from '../../domain/entities/geofence.entity';
import { GeofenceRepository } from '../../domain/repositories/geofence.repository';
import { AppError } from '@shared/domain/errors/app-errors';

@Injectable()
export class TypeOrmGeofenceRepository implements GeofenceRepository {
  constructor(
    @InjectRepository(GeofenceEntity)
    private readonly repository: Repository<GeofenceEntity>,
  ) {}

  async save(geofence: GeofenceEntity): Promise<Result<GeofenceEntity, AppError>> {
    try {
      const saved = await this.repository.save(geofence);
      return ok(saved);
    } catch (error) {
      console.error('Error saving geofence:', error);
      return err('INTERNAL_ERROR');
    }
  }

  async findById(id: string): Promise<Result<GeofenceEntity, AppError>> {
    try {
      const geofence = await this.repository.findOne({ where: { id } });
      if (!geofence) return err('NOT_FOUND');
      return ok(geofence);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }

  async findAllByTenant(tenantId: string): Promise<Result<GeofenceEntity[], AppError>> {
    try {
      const geofences = await this.repository.find({ where: { tenantId } });
      return ok(geofences);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }

  async delete(id: string): Promise<Result<boolean, AppError>> {
    try {
      const result = await this.repository.delete(id);
      return ok(result.affected ? result.affected > 0 : false);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }

  async findByTraccarId(tenantId: string, traccarGeofenceId: number): Promise<Result<GeofenceEntity | null, AppError>> {
    try {
      const geofence = await this.repository.findOne({ 
        where: { tenantId, traccarGeofenceId } 
      });
      return ok(geofence);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }
}
