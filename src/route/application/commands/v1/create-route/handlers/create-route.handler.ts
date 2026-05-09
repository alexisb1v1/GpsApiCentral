import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { CreateRouteCommand } from '../create-route.command';
import { RouteRepository } from '../../../../domain/repositories/route.repository';
import { RouteEntity } from '../../../../domain/entities/route.entity';
import { AppError } from '@shared/domain/errors/app-errors';
import { AuditService } from '@shared/application/services/audit.service';

@CommandHandler(CreateRouteCommand)
export class CreateRouteHandler implements ICommandHandler<CreateRouteCommand> {
  constructor(
    @Inject('RouteRepository')
    private readonly routeRepository: RouteRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(command: CreateRouteCommand): Promise<Result<RouteEntity, AppError>> {
    const route = new RouteEntity();
    route.name = command.name;
    route.tenantId = command.tenantId;
    route.isActive = true;

    const saveResult = await this.routeRepository.save(route);
    if (saveResult.isErr()) return err(saveResult.error);

    const savedRoute = saveResult.value;

    this.auditService.createLog({
      tenantId: command.tenantId,
      userId: command.userId,
      action: 'CREATE_ROUTE',
      entityName: 'routes',
      entityId: savedRoute.id,
      newValues: savedRoute,
      ipAddress: command.ipAddress,
      userAgent: command.userAgent,
    });

    return ok(savedRoute);
  }
}
