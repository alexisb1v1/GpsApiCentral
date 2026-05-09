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
}
