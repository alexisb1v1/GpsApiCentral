import { ApiProperty } from '@nestjs/swagger';

class TraccarEventDto {
  @ApiProperty({ required: false })
  type?: string;

  @ApiProperty({ required: false })
  deviceId?: number;

  @ApiProperty({ required: false })
  geofenceId?: number;
}

class TraccarPositionDto {
  @ApiProperty({ required: false })
  fixTime?: string;

  @ApiProperty({ required: false })
  latitude?: number;

  @ApiProperty({ required: false })
  longitude?: number;
}

class TraccarDeviceDto {
  @ApiProperty({ required: false })
  uniqueId?: string;
}

export class TraccarWebhookRequestDto {
  @ApiProperty({ type: () => TraccarEventDto, required: false })
  event?: TraccarEventDto;

  @ApiProperty({ type: () => TraccarPositionDto, required: false })
  position?: TraccarPositionDto;

  @ApiProperty({ type: () => TraccarDeviceDto, required: false })
  device?: TraccarDeviceDto;
}
