import { IsString, IsNotEmpty, MaxLength, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RegisterStatus } from '@shared/domain/enums/register-status.enum';

export class UpdateDriverRequestDto {
  @ApiProperty({ example: 'Carlos Mendoza' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'Q12345678', description: 'Número de Licencia de Conducir' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  licenseNumber: string;

  @ApiProperty({ example: '2028-12-31', description: 'Fecha de Vencimiento de la Licencia' })
  @IsNotEmpty()
  licenseExpiry: Date;

  @ApiProperty({ example: '70231945', description: 'DNI del Chofer' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(15)
  dni: string;

  @ApiProperty({ example: '+51 987654321', description: 'Teléfono de emergencia' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  phoneEmergency?: string;

  @ApiProperty({ example: 'ACTIVE', enum: RegisterStatus, description: 'Estado del Chofer' })
  @IsEnum(RegisterStatus)
  @IsOptional()
  status?: RegisterStatus;
}
