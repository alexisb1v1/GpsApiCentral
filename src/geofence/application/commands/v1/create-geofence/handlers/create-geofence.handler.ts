import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { CreateGeofenceCommand } from '../create-geofence.command';
import { GeofenceRepository } from '../../../../domain/repositories/geofence.repository';
import { GeofenceEntity } from '../../../../domain/entities/geofence.entity';
import { AppError } from '@shared/domain/errors/app-errors';
import { AuditService } from '@shared/application/services/audit.service';

@CommandHandler(CreateGeofenceCommand)
export class CreateGeofenceHandler implements ICommandHandler<CreateGeofenceCommand> {
  constructor(
    @Inject('GeofenceRepository')
    private readonly geofenceRepository: GeofenceRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(command: CreateGeofenceCommand): Promise<Result<GeofenceEntity, AppError>> {
    // 1. Verificar si ya existe el traccarGeofenceId para este tenant
    const existingResult = await this.geofenceRepository.findByTraccarId(command.tenantId, command.traccarGeofenceId);
    if (existingResult.isOk() && existingResult.value) {
      return err('ALREADY_EXISTS');
    }

    // 2. Crear la entidad
    const geofence = new GeofenceEntity();
    geofence.tenantId = command.tenantId;
    geofence.traccarGeofenceId = command.traccarGeofenceId;
    geofence.name = command.name;
    geofence.type = command.type;

    // 3. Guardar
    const saveResult = await this.geofenceRepository.save(geofence);
    if (saveResult.isErr()) return err(saveResult.error);

    const savedGeofence = saveResult.value;

    // 4. Auditoría
    this.auditService.createLog({
      tenantId: command.tenantId,
      userId: command.userId,
      action: 'CREATE_GEOFENCE',
      entityName: 'geofences',
      entityId: savedGeofence.id,
      newValues: savedGeofence,
      ipAddress: command.ipAddress,
      userAgent: command.userAgent,
    });

    return ok(savedGeofence);
  }
}
