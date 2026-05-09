import { ApiProperty } from '@nestjs/swagger';

export class CreateVehicleResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Vehículo registrado correctamente' })
  message: string;

  @ApiProperty()
  data?: any;

  constructor(success: boolean, message: string, data?: any) {
    this.success = success;
    this.message = message;
    this.data = data;
  }
}
