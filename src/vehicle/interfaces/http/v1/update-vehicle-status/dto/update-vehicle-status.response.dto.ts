import { ApiProperty } from '@nestjs/swagger';

export class UpdateVehicleStatusResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Estado del vehículo actualizado correctamente' })
  message: string;

  @ApiProperty()
  data?: any;

  constructor(success: boolean, message: string, data?: any) {
    this.success = success;
    this.message = message;
    this.data = data;
  }
}
