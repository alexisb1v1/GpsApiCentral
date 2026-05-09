import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsInt, IsUUID, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class RouteStopItemDto {
  @ApiProperty({ example: 'uuid-geofence' })
  @IsUUID()
  @IsNotEmpty()
  geofenceId: string;

  @ApiProperty({ example: 1, description: 'Orden del paradero (1, 2, 3...)' })
  @IsInt()
  @IsNotEmpty()
  stopOrder: number;

  @ApiProperty({ example: 15, description: 'Minutos acumulados desde la salida' })
  @IsInt()
  @IsNotEmpty()
  minutesFromStart: number;
}

export class UpdateRouteStopsRequestDto {
  @ApiProperty({ type: [RouteStopItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RouteStopItemDto)
  stops: RouteStopItemDto[];
}
