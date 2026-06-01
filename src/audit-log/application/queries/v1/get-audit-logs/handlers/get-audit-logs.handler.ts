import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GetAuditLogsQuery } from '../get-audit-logs.query';
import { AuditLogEntity } from '@shared/domain/entities/audit-log.entity';
import { AppError } from '@shared/domain/errors/app-errors';
import { PaginatedResult } from '@common/interfaces/paginated-result.interface';

@QueryHandler(GetAuditLogsQuery)
export class GetAuditLogsHandler implements IQueryHandler<GetAuditLogsQuery> {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditRepository: Repository<AuditLogEntity>,
  ) {}

  /**
   * Ejecuta la consulta de logs de auditoría aplicando filtros y paginación de forma segura.
   *
   * @param query - Parámetros de consulta
   * @returns Listado de logs de auditoría paginado
   */
  async execute(
    query: GetAuditLogsQuery,
  ): Promise<Result<PaginatedResult<AuditLogEntity>, AppError>> {
    try {
      const page = query.page && query.page > 0 ? query.page : 1;
      const limit = query.limit && query.limit > 0 ? query.limit : 10;
      const skip = (page - 1) * limit;

      const queryBuilder = this.auditRepository.createQueryBuilder('log');

      // Filtro de Tenant (Aislamiento Multi-tenant)
      if (query.tenantId) {
        queryBuilder.andWhere('log.tenantId = :tenantId', {
          tenantId: query.tenantId,
        });
      }

      // Filtro de Rango de Fechas (startDate y endDate)
      if (query.startDate) {
        const start = new Date(`${query.startDate}T00:00:00.000Z`);
        if (!isNaN(start.getTime())) {
          queryBuilder.andWhere('log.createdAt >= :start', { start });
        }
      }

      if (query.endDate) {
        const end = new Date(`${query.endDate}T23:59:59.999Z`);
        if (!isNaN(end.getTime())) {
          queryBuilder.andWhere('log.createdAt <= :end', { end });
        }
      }

      // Filtro de Acción (e.g., CREATE, UPDATE, DELETE)
      if (query.action) {
        queryBuilder.andWhere('log.action = :action', { action: query.action });
      }

      // Filtro de Entidad Afectada (e.g., VehicleEntity)
      if (query.entityName) {
        queryBuilder.andWhere('log.entityName ILIKE :entityName', {
          entityName: `%${query.entityName}%`,
        });
      }

      // Paginación y ordenamiento
      queryBuilder
        .orderBy('log.createdAt', 'DESC')
        .skip(skip)
        .take(limit);

      const [logs, total] = await queryBuilder.getManyAndCount();
      const totalPages = Math.ceil(total / limit);

      return ok({
        items: logs,
        totalItems: total,
        currentPage: page,
        totalPages,
        itemsPerPage: limit,
      });
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      return err('INTERNAL_ERROR');
    }
  }
}
