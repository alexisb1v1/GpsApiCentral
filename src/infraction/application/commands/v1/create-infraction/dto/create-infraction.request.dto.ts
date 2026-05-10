import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { InfractionType } from '@infraction/domain/entities/infraction.entity';

export class CreateInfractionRequestDto {
  @ApiProperty({ example: 'vehicle-uuid' })
  @IsUUID()
  vehicleId: string;

  @ApiProperty({ enum: InfractionType })
  @IsEnum(InfractionType)
  type: InfractionType;

  @ApiProperty({ example: 50.0 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ example: 'Pago por retraso en ruta', required: false })
  @IsString()
  @IsOptional()
  description?: string;
}
