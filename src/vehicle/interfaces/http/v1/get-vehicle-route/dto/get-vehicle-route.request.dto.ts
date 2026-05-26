import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty } from 'class-validator';

export class GetVehicleRouteRequestDto {
  @ApiProperty({
    description: 'Fecha y hora de inicio en formato ISO 8601 (UTC)',
    example: '2026-05-26T00:00:00Z',
    required: true,
  })
  @IsDateString()
  @IsNotEmpty()
  from: string;

  @ApiProperty({
    description: 'Fecha y hora de fin en formato ISO 8601 (UTC)',
    example: '2026-05-26T23:59:59Z',
    required: true,
  })
  @IsDateString()
  @IsNotEmpty()
  to: string;
}
