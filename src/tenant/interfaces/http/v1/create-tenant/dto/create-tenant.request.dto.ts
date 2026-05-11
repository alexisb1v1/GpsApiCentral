import { IsString, IsNotEmpty, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTenantRequestDto {
  @ApiProperty({ example: 'Empresa Demo', description: 'Nombre de la empresa' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'demo', description: 'Subdominio único para la empresa' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  subdomain: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ example: 'https://cdn.pixabay.com/photo/2015/04/23/22/00/tree-736885__480.jpg', required: false })
  @IsString()
  @IsOptional()
  logoUrl?: string;

  @ApiProperty({ example: '#3f51b5', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(7)
  primaryColor?: string;

  @ApiProperty({ example: '#ff4081', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(7)
  accentColor?: string;

  @ApiProperty({ example: '#4caf50', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(7)
  statusDotColor?: string;
}
