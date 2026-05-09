import { ApiProperty } from '@nestjs/swagger';

class TraccarEventDto {
  @ApiProperty()
  type: string;

  @ApiProperty()
  deviceId: number;

  @ApiProperty()
  geofenceId: number;
}

class TraccarPositionDto {
  @ApiProperty()
  fixTime: string;

  @ApiProperty()
  latitude: number;

  @ApiProperty()
  longitude: number;
}

class TraccarDeviceDto {
  @ApiProperty()
  uniqueId: string;
}

export class TraccarWebhookRequestDto {
  @ApiProperty()
  event: TraccarEventDto;

  @ApiProperty()
  position: TraccarPositionDto;

  @ApiProperty()
  device: TraccarDeviceDto;
}
