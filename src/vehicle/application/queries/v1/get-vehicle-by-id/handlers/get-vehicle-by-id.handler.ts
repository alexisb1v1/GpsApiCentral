import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Result } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { GetVehicleByIdQuery } from '../get-vehicle-by-id.query';
import { VehicleRepository } from '@vehicle/domain/repositories/vehicle.repository';
import { VehicleEntity } from '@vehicle/domain/entities/vehicle.entity';
import { AppError } from '@shared/domain/errors/app-errors';

@QueryHandler(GetVehicleByIdQuery)
export class GetVehicleByIdHandler implements IQueryHandler<GetVehicleByIdQuery> {
  constructor(
    @Inject('VehicleRepository')
    private readonly vehicleRepository: VehicleRepository,
  ) {}

  async execute(query: GetVehicleByIdQuery): Promise<Result<VehicleEntity, AppError>> {
    return await this.vehicleRepository.findById(query.id);
  }
}
