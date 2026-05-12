import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginRequestDto {
  @ApiProperty({ example: 'admin@miflota.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ example: 'miflota' })
  @IsString()
  @IsNotEmpty()
  tenant: string;
}

export class LoginResponseDto {
  @ApiProperty()
  accessToken: string;
}
