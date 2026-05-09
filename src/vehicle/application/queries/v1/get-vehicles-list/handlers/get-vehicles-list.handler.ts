import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Result } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { GetVehiclesListQuery } from '../get-vehicles-list.query';
import { VehicleRepository } from '@vehicle/domain/repositories/vehicle.repository';
import { VehicleEntity } from '@vehicle/domain/entities/vehicle.entity';
import { AppError } from '@shared/domain/errors/app-errors';

@QueryHandler(GetVehiclesListQuery)
export class GetVehiclesListHandler implements IQueryHandler<GetVehiclesListQuery> {
  constructor(
    @Inject('VehicleRepository')
    private readonly vehicleRepository: VehicleRepository,
  ) {}

  async execute(query: GetVehiclesListQuery): Promise<Result<VehicleEntity[], AppError>> {
    return await this.vehicleRepository.findAllByTenant(query.tenantId);
  }
}
