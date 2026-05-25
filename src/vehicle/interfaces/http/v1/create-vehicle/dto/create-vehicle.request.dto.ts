import { IsString, IsNotEmpty, IsOptional, IsInt, MaxLength, Min, Max, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateVehicleRequestDto {
  @ApiProperty({ example: 'ABC-123', description: 'Placa única del vehículo' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  plate: string;

  @ApiProperty({ example: '864455001122334', description: 'Identificador único del dispositivo GPS (IMEI o ID de App)', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  uniqueId?: string;



  @ApiProperty({ example: 2024, description: 'Año del vehículo' })
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear() + 1)
  year: number;



  @ApiProperty({ example: 40, description: 'Capacidad de pasajeros', required: false })
  @IsInt()
  @IsOptional()
  @Min(1)
  passengerCapacity?: number;

  @ApiProperty({ example: 'Juan Perez', description: 'Nombre del propietario', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(150)
  ownerName?: string;

  @ApiProperty({ example: '987654321', description: 'Teléfono del propietario', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  ownerPhone?: string;

  @ApiProperty({ example: 'OPERATIVO', enum: ['OPERATIVO', 'TALLER', 'BAJA'], required: false })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({ example: 'uuid-v4', description: 'ID del Tenant al que pertenece el vehículo' })
  @IsUUID()
  @IsNotEmpty()
  tenantId: string;
}
