import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class AnnulInfractionDto {
  @ApiProperty({
    description: 'Motivo de la anulación',
    example: 'Error en la identificación del vehículo',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  reason: string;
}

export class AnnulInfractionResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Infracción anulada correctamente' })
  message: string;

  constructor(success: boolean, message: string) {
    this.success = success;
    this.message = message;
  }
}
