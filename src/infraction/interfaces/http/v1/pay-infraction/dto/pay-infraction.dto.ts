import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class PayInfractionDto {
  @ApiProperty({
    description: 'ID de referencia del pago (opcional)',
    example: 'PAY-123456',
    required: false,
  })
  @IsString()
  @IsOptional()
  paymentId?: string;
}
