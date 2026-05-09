import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { VehicleStatus } from '@vehicle/domain/entities/vehicle.entity';

export class UpdateVehicleStatusRequestDto {
  @ApiProperty({ 
    example: 'OPERATIVO', 
    enum: VehicleStatus,
    description: 'Nuevo estado del vehículo' 
  })
  @IsEnum(VehicleStatus)
  @IsNotEmpty()
  status: VehicleStatus;
}
