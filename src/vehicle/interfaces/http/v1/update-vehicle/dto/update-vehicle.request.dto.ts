import { IsString, IsNotEmpty, IsOptional, IsInt, MaxLength, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateVehicleRequestDto {
  @ApiProperty({ example: 'ABC-123' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  plate: string;

  @ApiProperty({ example: 12345, required: false })
  @IsInt()
  @IsOptional()
  traccarDeviceId?: number;



  @ApiProperty({ example: 2024 })
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear() + 1)
  year: number;



  @ApiProperty({ example: 40, required: false })
  @IsInt()
  @IsOptional()
  @Min(1)
  passengerCapacity?: number;

  @ApiProperty({ example: 'Juan Perez', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(150)
  ownerName?: string;

  @ApiProperty({ example: '987654321', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  ownerPhone?: string;

  @ApiProperty({ example: 'OPERATIVO', enum: ['OPERATIVO', 'TALLER', 'BAJA'], required: false })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({ example: 'uuid-v4', required: false })
  @IsString()
  @IsOptional()
  tenantId?: string;
}
