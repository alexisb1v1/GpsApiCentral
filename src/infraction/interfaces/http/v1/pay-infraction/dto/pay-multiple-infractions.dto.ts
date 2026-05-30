import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, ArrayNotEmpty } from 'class-validator';

export class PayMultipleInfractionsDto {
  @ApiProperty({
    description: 'Arreglo de IDs de infracciones a pagar en lote',
    example: ['71a2faff-8181-4ea2-9e0f-a826b7e83430', '99f2b8ba-2081-4ab2-8d0f-e226d7f88415'],
    required: true,
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  infractionIds: string[];

  @ApiProperty({
    description: 'Método de pago (EFECTIVO, TRANSFERENCIA, BILLETERA_DIGITAL)',
    example: 'TRANSFERENCIA',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  paymentMethod: string;

  @ApiProperty({
    description: 'Referencia / Código de operación bancaria si aplica',
    example: 'REF-99201',
    required: false,
  })
  @IsString()
  @IsOptional()
  operationReference?: string;
}
