import { Controller, Get, Req, Query, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { Roles } from '@shared/infrastructure/decorators/roles.decorator';
import { RolesGuard } from '@shared/infrastructure/guards/roles.guard';
import { matchResult } from '@common/http/match-result';
import { GetAuditLogsRequestDto } from './dto/get-audit-logs.request.dto';
import { GetAuditLogsResponseDto, AuditLogItemDto } from './dto/get-audit-logs.response.dto';
import { GetAuditLogsQuery } from '@audit-log/application/queries/v1/get-audit-logs/get-audit-logs.query';
import { AuditLogEntity } from '@shared/domain/entities/audit-log.entity';
import { PaginatedResult } from '@common/interfaces/paginated-result.interface';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@Controller('v1/admin/audit-logs')
export class GetAuditLogsController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Obtener bitácora de auditoría (Audit Logs) con filtros y paginación' })
  @ApiResponse({ status: 200, type: GetAuditLogsResponseDto, description: 'Listado de logs cargado exitosamente' })
  async execute(
    @Req() req: any,
    @Query() dto: GetAuditLogsRequestDto,
  ) {
    const { role, tenantId: sessionTenantId } = req.user;

    // Aislamiento Multi-tenant: 
    // - Si es ADMIN, se fuerza su tenantId de la sesión para evitar que consulte datos de otros tenants.
    // - Si es SUPER_ADMIN, se permite filtrar por el tenantId provisto en el DTO o consultar todos (null).
    const queryTenantId = role === 'SUPER_ADMIN' ? (dto.tenantId || null) : sessionTenantId;

    const result = await this.queryBus.execute(
      new GetAuditLogsQuery(
        queryTenantId,
        dto.startDate,
        dto.endDate,
        dto.action,
        dto.entityName,
        dto.page,
        dto.limit,
      ),
    );

    // Mapear cada entidad del ORM al DTO de respuesta para no exponer entidades directas
    return matchResult(result, (paginated: PaginatedResult<AuditLogEntity>) => ({
      items: paginated.items.map((entity: AuditLogEntity): AuditLogItemDto => ({
        id: entity.id,
        tenantId: entity.tenantId,
        userId: entity.userId,
        action: entity.action,
        entityName: entity.entityName,
        entityId: entity.entityId,
        oldValues: entity.oldValues,
        newValues: entity.newValues,
        ipAddress: entity.ipAddress,
        userAgent: entity.userAgent,
        createdAt: entity.createdAt,
      })),
      totalItems: paginated.totalItems,
      currentPage: paginated.currentPage,
      totalPages: paginated.totalPages,
      itemsPerPage: paginated.itemsPerPage,
    }));
  }
}
