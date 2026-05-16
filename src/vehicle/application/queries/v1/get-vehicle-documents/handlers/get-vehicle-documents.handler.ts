import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Result } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { GetVehicleDocumentsQuery } from '../get-vehicle-documents.query';
import { VehicleDocumentRepository } from '@vehicle/domain/repositories/vehicle-document.repository';
import { VehicleDocumentEntity } from '@vehicle/domain/entities/vehicle-document.entity';
import { AppError } from '@shared/domain/errors/app-errors';

@QueryHandler(GetVehicleDocumentsQuery)
export class GetVehicleDocumentsHandler implements IQueryHandler<GetVehicleDocumentsQuery> {
  constructor(
    @Inject('VehicleDocumentRepository')
    private readonly repository: VehicleDocumentRepository,
  ) {}

  async execute(query: GetVehicleDocumentsQuery): Promise<Result<VehicleDocumentEntity[], AppError>> {
    return await this.repository.findByVehicleId(query.vehicleId);
  }
}
