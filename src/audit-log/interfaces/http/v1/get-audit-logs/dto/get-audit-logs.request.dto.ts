import { IsOptional, IsString, IsInt, Min, IsUUID, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetAuditLogsRequestDto {
  @ApiPropertyOptional({ description: 'ID del Tenant para filtrar (Solo aplicable para SUPER_ADMIN)', example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsOptional()
  @IsUUID()
  readonly tenantId?: string;

  @ApiPropertyOptional({ description: 'Fecha de inicio del rango a consultar (formato YYYY-MM-DD)', example: '2026-06-01' })
  @IsOptional()
  @IsDateString()
  readonly startDate?: string;

  @ApiPropertyOptional({ description: 'Fecha de fin del rango a consultar (formato YYYY-MM-DD)', example: '2026-06-30' })
  @IsOptional()
  @IsDateString()
  readonly endDate?: string;

  @ApiPropertyOptional({ description: 'Acción u operación realizada (e.g., CREATE, UPDATE, DELETE)', example: 'UPDATE' })
  @IsOptional()
  @IsString()
  readonly action?: string;

  @ApiPropertyOptional({ description: 'Nombre de la entidad involucrada (e.g., VehicleEntity)', example: 'VehicleEntity' })
  @IsOptional()
  @IsString()
  readonly entityName?: string;

  @ApiPropertyOptional({ description: 'Número de página para la paginación', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly page?: number = 1;

  @ApiPropertyOptional({ description: 'Cantidad de registros por página', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly limit?: number = 10;
}
