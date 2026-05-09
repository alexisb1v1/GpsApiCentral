import { IsString, IsNotEmpty, IsOptional, IsInt, MaxLength, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateVehicleRequestDto {
  @ApiProperty({ example: 'ABC-123' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  plate: string;

  @ApiProperty({ example: '123456789012345', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  traccarDeviceId?: string;

  @ApiProperty({ example: 'Toyota' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  brand: string;

  @ApiProperty({ example: 'Corolla' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  model: string;

  @ApiProperty({ example: 2024 })
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear() + 1)
  year: number;

  @ApiProperty({ example: 'Blanco', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(30)
  color?: string;
}
