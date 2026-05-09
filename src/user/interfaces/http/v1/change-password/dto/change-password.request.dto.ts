import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordRequestDto {
  @ApiProperty({ example: 'currentPassword123', description: 'Contraseña actual para validación' })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({ example: 'newPassword456!', description: 'Nueva contraseña deseada' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  newPassword: string;
}
