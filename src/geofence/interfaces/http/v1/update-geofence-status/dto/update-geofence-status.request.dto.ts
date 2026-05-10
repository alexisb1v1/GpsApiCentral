import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsEnum } from 'class-validator';
import { RegisterStatus } from '@shared/domain/enums/register-status.enum';

export class UpdateGeofenceStatusRequestDto {
  @ApiProperty({ enum: RegisterStatus, example: RegisterStatus.DELETE })
  @IsNotEmpty()
  @IsEnum(RegisterStatus)
  status: RegisterStatus;
}
