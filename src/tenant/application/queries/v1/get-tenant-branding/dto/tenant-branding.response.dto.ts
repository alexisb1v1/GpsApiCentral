import { ApiProperty } from '@nestjs/swagger';

export class TenantBrandingResponseDto {
  @ApiProperty()
  name: string;

  @ApiProperty({ required: false, nullable: true })
  logoUrl: string | null;

  @ApiProperty({ required: false, nullable: true })
  loginUrl: string | null;

  @ApiProperty({ required: false, nullable: true })
  primaryColor: string | null;

  @ApiProperty({ required: false, nullable: true })
  accentColor: string | null;

  @ApiProperty({ required: false, nullable: true })
  statusDotColor: string | null;

  constructor(data: any) {
    this.name = data.name;
    this.logoUrl = data.logoUrl;
    this.loginUrl = data.loginUrl;
    this.primaryColor = data.primaryColor;
    this.accentColor = data.accentColor;
    this.statusDotColor = data.statusDotColor;
  }
}
