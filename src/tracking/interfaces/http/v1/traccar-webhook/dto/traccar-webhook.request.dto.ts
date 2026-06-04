import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, ValidateNested, IsObject, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class TraccarEventDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  deviceId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  geofenceId?: number;
}

class TraccarPositionDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  fixTime?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  longitude?: number;
}

class TraccarDeviceDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  uniqueId?: string;
}

export class TraccarWebhookRequestDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => TraccarEventDto)
  event?: TraccarEventDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => TraccarPositionDto)
  position?: TraccarPositionDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => TraccarDeviceDto)
  device?: TraccarDeviceDto;
}
