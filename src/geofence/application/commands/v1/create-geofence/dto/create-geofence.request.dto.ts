import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsInt, IsEnum } from 'class-validator';
import { GeofenceType } from '../../../../domain/entities/geofence.entity';

export class CreateGeofenceRequestDto {
  @ApiProperty({ description: 'ID de la geocerca en Traccar', example: 123 })
  @IsNotEmpty()
  @IsInt()
  traccarGeofenceId: number;

  @ApiProperty({ description: 'Nombre de la geocerca/paradero', example: 'Paradero Inicial Norte' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ description: 'Tipo de geocerca', enum: GeofenceType, example: GeofenceType.START })
  @IsNotEmpty()
  @IsEnum(GeofenceType)
  type: GeofenceType;
}
