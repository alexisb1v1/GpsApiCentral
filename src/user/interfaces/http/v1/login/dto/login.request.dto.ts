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

  @ApiProperty({ example: 'a9b8c7d6...', required: false })
  @IsString()
  deviceFingerprint?: string;
}

export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  tenantId: string;
}

export class LoginResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;

  @ApiProperty()
  token: string;

  @ApiProperty({ nullable: true })
  refreshToken: string | null;
}

export class RefreshTokenRequestDto {
  @ApiProperty({ example: 'abcdef...' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;

  @ApiProperty({ example: 'a9b8c7d6...' })
  @IsString()
  @IsNotEmpty()
  deviceFingerprint: string;
}

export class RefreshTokenResponseDto {
  @ApiProperty()
  token: string;

  @ApiProperty()
  refreshToken: string;
}
