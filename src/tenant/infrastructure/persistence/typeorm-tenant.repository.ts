import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ok, err, Result } from 'neverthrow';
import { TenantEntity } from '../../domain/entities/tenant.entity';
import { TenantRepository } from '../../domain/repositories/tenant.repository';
import { AppError } from '@shared/domain/errors/app-errors';

@Injectable()
export class TypeOrmTenantRepository implements TenantRepository {
  constructor(
    @InjectRepository(TenantEntity)
    private readonly repository: Repository<TenantEntity>,
  ) {}

  async save(tenant: Partial<TenantEntity>): Promise<Result<TenantEntity, AppError>> {
    try {
      const savedTenant = await this.repository.save(tenant);
      return ok(savedTenant);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }

  async findById(id: string): Promise<Result<TenantEntity, AppError>> {
    try {
      const tenant = await this.repository.findOne({ where: { id } });
      if (!tenant) return err('NOT_FOUND');
      return ok(tenant);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }

  async findBySubdomain(subdomain: string): Promise<Result<TenantEntity, AppError>> {
    try {
      const tenant = await this.repository.findOne({ where: { subdomain } });
      if (!tenant) return err('NOT_FOUND');
      return ok(tenant);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }

  async findAll(): Promise<Result<TenantEntity[], AppError>> {
    try {
      const tenants = await this.repository.find();
      return ok(tenants);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }
}
