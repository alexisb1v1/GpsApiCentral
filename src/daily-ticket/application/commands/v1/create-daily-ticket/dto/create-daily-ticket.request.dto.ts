import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID, IsNumber, IsOptional, IsString, IsDateString, Min } from 'class-validator';

export class CreateDailyTicketRequestDto {
  @ApiProperty({ description: 'ID del vehículo', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsNotEmpty()
  @IsUUID()
  vehicleId: string;

  @ApiProperty({ description: 'ID del conductor', example: '550e8400-e29b-41d4-a716-446655440002', required: false })
  @IsOptional()
  @IsUUID()
  driverId?: string;

  @ApiProperty({ description: 'Monto total pagado', example: 10.50 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  totalAmount: number;

  @ApiProperty({ description: 'Comisión administrativa', example: 5.50 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  adminFee: number;

  @ApiProperty({ description: 'Cuota de ruta', example: 5.00 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  routeFee: number;

  @ApiProperty({ description: 'ID de la ruta (opcional)', example: '550e8400-e29b-41d4-a716-446655440001', required: false })
  @IsOptional()
  @IsUUID()
  routeId?: string;

  @ApiProperty({ description: 'Fecha de trabajo (opcional, default hoy)', example: '2024-05-08', required: false })
  @IsOptional()
  @IsDateString()
  workDate?: string;
}
