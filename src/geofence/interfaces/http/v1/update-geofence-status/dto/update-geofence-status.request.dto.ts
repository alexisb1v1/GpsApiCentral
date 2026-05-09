import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsEnum } from 'class-validator';
import { RegisterStatus } from '../../../../domain/entities/geofence.entity';

export class UpdateGeofenceStatusRequestDto {
  @ApiProperty({ enum: RegisterStatus, example: RegisterStatus.INACTIVO })
  @IsNotEmpty()
  @IsEnum(RegisterStatus)
  status: RegisterStatus;
}
