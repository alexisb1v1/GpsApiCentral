import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsRuc } from '@shared/decorators/is-ruc.decorator';

export class UpdateTenantRequestDto {
  @ApiProperty({ example: 'Empresa Actualizada', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ example: 'demo-new', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  subdomain?: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ example: 'https://cdn.pixabay.com/photo/2015/04/23/22/00/tree-736885__480.jpg', required: false })
  @IsString()
  @IsOptional()
  logoUrl?: string;

  @ApiProperty({ example: 'https://cdn.pixabay.com/photo/2015/04/23/22/00/tree-736885__480.jpg', required: false })
  @IsString()
  @IsOptional()
  loginUrl?: string;

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

  @ApiProperty({ example: 'Calle 123, Ciudad', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ example: '+51 987654321', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  phone?: string;

  @ApiProperty({ example: '20123456789', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  taxId?: string;
}
