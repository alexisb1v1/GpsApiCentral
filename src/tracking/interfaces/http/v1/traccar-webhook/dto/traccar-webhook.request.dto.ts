import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, ValidateNested, IsObject, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class TraccarEventDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  type: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  deviceId: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  geofenceId?: number;
}

class TraccarPositionDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  fixTime: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  latitude: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  longitude: number;
}

class TraccarDeviceDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  uniqueId: string;
}

export class TraccarWebhookRequestDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsObject()
  @ValidateNested()
  @Type(() => TraccarEventDto)
  event: TraccarEventDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => TraccarPositionDto)
  position?: TraccarPositionDto;

  @ApiProperty()
  @IsNotEmpty()
  @IsObject()
  @ValidateNested()
  @Type(() => TraccarDeviceDto)
  device: TraccarDeviceDto;
}
