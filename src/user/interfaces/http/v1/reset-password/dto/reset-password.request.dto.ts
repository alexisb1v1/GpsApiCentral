import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordRequestDto {
  @ApiProperty({ example: 'newPassword123!', description: 'Nueva contraseña generada por el admin' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  newPassword: string;
}
