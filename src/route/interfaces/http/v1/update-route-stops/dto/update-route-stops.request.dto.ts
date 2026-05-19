import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsInt, IsString, IsNumber, IsArray, ValidateNested, IsOptional, IsUUID, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
 
export class RouteStopItemDto {
  @ApiPropertyOptional({ example: 'uuid-geofence', description: 'ID de la geocerca local si ya existe' })
  @IsOptional()
  @IsUUID()
  geofenceId?: string;

  @ApiProperty({ example: 'Terminal A', description: 'Nombre del paradero' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: -12.046374, description: 'Latitud del paradero' })
  @IsNotEmpty()
  @IsNumber()
  lat: number;

  @ApiProperty({ example: -77.042793, description: 'Longitud del paradero' })
  @IsNotEmpty()
  @IsNumber()
  lng: number;

  @ApiProperty({ example: 1, description: 'Orden del paradero (1, 2, 3...)' })
  @IsInt()
  @IsNotEmpty()
  stopOrder: number;

  @ApiProperty({ example: 15, description: 'Minutos acumulados desde la salida' })
  @IsInt()
  @IsNotEmpty()
  minutesFromStart: number;

  @ApiPropertyOptional({ example: [{ lat: -12.0463, lng: -77.0427 }], description: 'Vértices del polígono del paradero' })
  @IsOptional()
  @IsArray()
  polygonCoordinates?: { lat: number; lng: number }[];
}

export class UpdateRouteStopsRequestDto {
  @ApiPropertyOptional({ example: 'Línea Metropolitana A', description: 'Nuevo nombre de la ruta' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: true, description: 'Estado de activación de la ruta' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ type: [RouteStopItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RouteStopItemDto)
  stops: RouteStopItemDto[];

  @ApiPropertyOptional({ example: [{ lat: -12.0463, lng: -77.0427 }], description: 'Vértices del recorrido de la ruta' })
  @IsOptional()
  @IsArray()
  coordinates?: { lat: number; lng: number }[];
}
