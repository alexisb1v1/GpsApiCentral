import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ok, err, Result } from 'neverthrow';
import { UserEntity } from '@user/domain/entities/user.entity';
import { UserRepository } from '@user/domain/repositories/user.repository';
import { AppError } from '@shared/domain/errors/app-errors';

@Injectable()
export class TypeOrmUserRepository implements UserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repository: Repository<UserEntity>,
  ) {}

  async save(user: Partial<UserEntity>): Promise<Result<UserEntity, AppError>> {
    try {
      const savedUser = await this.repository.save(user);
      return ok(savedUser);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }

  async findById(id: string): Promise<Result<UserEntity, AppError>> {
    try {
      const user = await this.repository.findOne({ 
        where: { id },
        relations: ['driverInfo'],
      });
      if (!user) return err('NOT_FOUND');
      return ok(user);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }

  async findByEmail(email: string): Promise<Result<UserEntity, AppError>> {
    try {
      const user = await this.repository.findOne({ 
        where: { email },
        relations: ['driverInfo'],
      });
      if (!user) return err('NOT_FOUND');
      return ok(user);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }

  async findByTenantId(tenantId: string): Promise<Result<UserEntity[], AppError>> {
    try {
      const where = tenantId ? { tenantId } : {};
      const users = await this.repository.find({ 
        where,
        relations: ['driverInfo'],
        order: { createdAt: 'DESC' }
      });
      return ok(users);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }

  async findDriversByTenantId(tenantId: string): Promise<Result<UserEntity[], AppError>> {
    try {
      const where: any = { role: 'DRIVER' };
      if (tenantId) {
        where.tenantId = tenantId;
      }
      const drivers = await this.repository.find({
        where,
        relations: ['driverInfo'],
        order: { createdAt: 'DESC' }
      });
      return ok(drivers);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }

  async findByDniAndTenantId(dni: string, tenantId: string): Promise<Result<UserEntity, AppError>> {
    try {
      const user = await this.repository.findOne({
        where: {
          tenantId,
          driverInfo: { dni },
        },
        relations: ['driverInfo'],
      });
      if (!user) return err('NOT_FOUND');
      return ok(user);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }
}
