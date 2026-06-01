import { ApiProperty } from '@nestjs/swagger';

export class AuditLogItemDto {
  @ApiProperty({ description: 'ID único del log de auditoría', example: 'e4b2d3d9-9c0b-4ef8-bb6d-6bb9bd380a11' })
  id: string;

  @ApiProperty({ description: 'ID del Tenant asociado (null si es global)', example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', nullable: true })
  tenantId: string | null;

  @ApiProperty({ description: 'ID del usuario que realizó la acción', example: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', nullable: true })
  userId: string | null;

  @ApiProperty({ description: 'Nombre de usuario o correo de quien realizó la acción (para visualización)', example: 'admin@empresa.com', nullable: true })
  userName?: string | null;

  @ApiProperty({ description: 'Acción realizada (e.g., CREATE, UPDATE, DELETE)', example: 'UPDATE' })
  action: string;

  @ApiProperty({ description: 'Entidad sobre la cual se ejecutó la acción', example: 'VehicleEntity' })
  entityName: string;

  @ApiProperty({ description: 'ID de la entidad afectada', example: 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', nullable: true })
  entityId: string | null;

  @ApiProperty({ description: 'Valores anteriores del registro (estado antes del cambio)', example: { status: 'INACTIVE' }, nullable: true })
  oldValues: any;

  @ApiProperty({ description: 'Valores nuevos del registro (estado después del cambio)', example: { status: 'ACTIVE' }, nullable: true })
  newValues: any;

  @ApiProperty({ description: 'Dirección IP desde donde se realizó la acción', example: '192.168.1.1', nullable: true })
  ipAddress: string | null;

  @ApiProperty({ description: 'User-agent de la petición', example: 'Mozilla/5.0...', nullable: true })
  userAgent: string | null;

  @ApiProperty({ description: 'Fecha y hora del registro del log', example: '2026-06-01T12:00:00.000Z' })
  createdAt: Date;
}

export class GetAuditLogsDataDto {
  @ApiProperty({ type: [AuditLogItemDto], description: 'Listado de logs de auditoría' })
  logs: AuditLogItemDto[];

  @ApiProperty({ description: 'Cantidad total de registros que coinciden con los filtros', example: 100 })
  total: number;

  @ApiProperty({ description: 'Número de página actual', example: 1 })
  page: number;

  @ApiProperty({ description: 'Límite de registros por página', example: 10 })
  limit: number;
}

export class GetAuditLogsResponseDto {
  @ApiProperty({ description: 'Indica si la solicitud fue procesada con éxito', example: true })
  success: boolean;

  @ApiProperty({ description: 'Mensaje informativo', example: 'Logs de auditoría cargados exitosamente' })
  message: string;

  @ApiProperty({ type: GetAuditLogsDataDto, description: 'Datos del listado de auditoría' })
  data: GetAuditLogsDataDto;
}
