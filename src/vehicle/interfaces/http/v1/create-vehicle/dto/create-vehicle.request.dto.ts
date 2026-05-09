import { IsString, IsNotEmpty, IsOptional, IsInt, MaxLength, Min, Max, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateVehicleRequestDto {
  @ApiProperty({ example: 'ABC-123', description: 'Placa única del vehículo' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  plate: string;

  @ApiProperty({ example: '123456789012345', description: 'ID de Traccar (IMEI/UniqueId)', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  traccarDeviceId?: string;

  @ApiProperty({ example: 'Toyota', description: 'Marca del vehículo' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  brand: string;

  @ApiProperty({ example: 'Corolla', description: 'Modelo del vehículo' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  model: string;

  @ApiProperty({ example: 2024, description: 'Año del vehículo' })
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear() + 1)
  year: number;

  @ApiProperty({ example: 'Blanco', required: false, description: 'Color del vehículo' })
  @IsString()
  @IsOptional()
  @MaxLength(30)
  color?: string;

  @ApiProperty({ example: 'uuid-v4', description: 'ID del Tenant al que pertenece el vehículo' })
  @IsUUID()
  @IsNotEmpty()
  tenantId: string;
}
