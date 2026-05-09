import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateRouteRequestDto {
  @ApiProperty({ example: 'Ruta A - Ida', description: 'Nombre de la ruta' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;
}
