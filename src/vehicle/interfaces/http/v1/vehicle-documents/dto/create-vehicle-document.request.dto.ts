import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsString, IsNotEmpty, IsOptional, IsBoolean, IsDateString } from 'class-validator';

export class CreateVehicleDocumentRequestDto {
  @ApiProperty({ description: 'ID del vehículo', example: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  vehicleId: string;

  @ApiProperty({ description: 'Tipo de documento', example: 'SOAT' })
  @IsString()
  @IsNotEmpty()
  documentType: string;

  @ApiProperty({ description: 'Número del documento', example: '12345678' })
  @IsString()
  @IsNotEmpty()
  documentNumber: string;

  @ApiProperty({ description: 'Fecha de expiración', example: '2025-12-31', required: false })
  @IsDateString()
  @IsOptional()
  expirationDate?: string;

  @ApiProperty({ description: 'Notificar antes de expirar', example: true, default: false })
  @IsBoolean()
  @IsOptional()
  notifyExpiration?: boolean;
}
