import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { UpdateGeofenceStatusCommand } from '../update-geofence-status.command';
import { GeofenceRepository } from '../../../../domain/repositories/geofence.repository';
import { AppError } from '@shared/domain/errors/app-errors';
import { AuditService } from '@shared/application/services/audit.service';

@CommandHandler(UpdateGeofenceStatusCommand)
export class UpdateGeofenceStatusHandler implements ICommandHandler<UpdateGeofenceStatusCommand> {
  constructor(
    @Inject('GeofenceRepository')
    private readonly geofenceRepository: GeofenceRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(command: UpdateGeofenceStatusCommand): Promise<Result<boolean, AppError>> {
    // 1. Buscar la geocerca
    const geofenceResult = await this.geofenceRepository.findById(command.id);
    if (geofenceResult.isErr()) return err(geofenceResult.error);

    const geofence = geofenceResult.value;

    // 2. Validar tenant
    if (geofence.tenantId !== command.tenantId) {
      return err('FORBIDDEN');
    }

    const oldValues = { ...geofence };

    // 3. Actualizar estado
    geofence.status = command.status;
    const saveResult = await this.geofenceRepository.save(geofence);
    if (saveResult.isErr()) return err(saveResult.error);

    // 4. Auditoría (¡Implementada!)
    this.auditService.createLog({
      tenantId: command.tenantId,
      userId: command.userId,
      action: 'UPDATE_GEOFENCE_STATUS',
      entityName: 'geofences',
      entityId: geofence.id,
      oldValues: oldValues,
      newValues: { status: command.status },
      ipAddress: command.ipAddress,
      userAgent: command.userAgent,
    });

    return ok(true);
  }
}
