import { ApiProperty } from '@nestjs/swagger';

export class PayInfractionResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Pago procesado correctamente' })
  message: string;

  constructor(success: boolean, message: string) {
    this.success = success;
    this.message = message;
  }
}
