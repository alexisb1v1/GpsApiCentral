import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Result, ok, err } from 'neverthrow';
import { RouteEntity } from '../../domain/entities/route.entity';
import { RouteStopEntity } from '../../domain/entities/route-stop.entity';
import { RouteRepository } from '../../domain/repositories/route.repository';
import { AppError } from '@shared/domain/errors/app-errors';

@Injectable()
export class TypeOrmRouteRepository implements RouteRepository {
  constructor(
    @InjectRepository(RouteEntity)
    private readonly routeRepository: Repository<RouteEntity>,
    @InjectRepository(RouteStopEntity)
    private readonly stopRepository: Repository<RouteStopEntity>,
  ) {}

  async save(route: RouteEntity): Promise<Result<RouteEntity, AppError>> {
    try {
      const saved = await this.routeRepository.save(route);
      return ok(saved);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }

  async findById(id: string): Promise<Result<RouteEntity, AppError>> {
    try {
      const route = await this.routeRepository.findOne({
        where: { id },
        relations: ['stops', 'stops.geofence'],
      });
      if (!route) return err('NOT_FOUND');
      return ok(route);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }

  async findAllByTenant(tenantId: string): Promise<Result<RouteEntity[], AppError>> {
    try {
      const routes = await this.routeRepository.find({
        where: { tenantId },
        order: { name: 'ASC' },
      });
      return ok(routes);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }

  async delete(id: string): Promise<Result<boolean, AppError>> {
    try {
      const result = await this.routeRepository.delete(id);
      return ok(result.affected ? result.affected > 0 : false);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }

  async saveStops(stops: RouteStopEntity[]): Promise<Result<RouteStopEntity[], AppError>> {
    try {
      const saved = await this.stopRepository.save(stops);
      return ok(saved);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }

  async deleteStopsByRoute(routeId: string): Promise<Result<void, AppError>> {
    try {
      await this.stopRepository.delete({ routeId });
      return ok(undefined);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }
}
