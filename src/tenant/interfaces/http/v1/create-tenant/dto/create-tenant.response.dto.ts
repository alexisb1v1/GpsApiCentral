import { ApiProperty } from '@nestjs/swagger';

export class CreateTenantResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  subdomain: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ required: false, nullable: true })
  logoUrl: string | null;

  @ApiProperty({ required: false, nullable: true })
  primaryColor: string | null;

  @ApiProperty({ required: false, nullable: true })
  accentColor: string | null;

  @ApiProperty({ required: false, nullable: true })
  statusDotColor: string | null;

  @ApiProperty({ required: false, nullable: true })
  loginUrl: string | null;

  @ApiProperty({ required: false, nullable: true })
  address: string | null;

  @ApiProperty({ required: false, nullable: true })
  phone: string | null;

  @ApiProperty({ required: false, nullable: true })
  taxId: string | null;

  @ApiProperty()
  createdAt: Date;

  constructor(data: any) {
    this.id = data.id;
    this.name = data.name;
    this.subdomain = data.subdomain;
    this.isActive = data.isActive;
    this.logoUrl = data.logoUrl;
    this.loginUrl = data.loginUrl;
    this.primaryColor = data.primaryColor;
    this.accentColor = data.accentColor;
    this.statusDotColor = data.statusDotColor;
    this.address = data.address;
    this.phone = data.phone;
    this.taxId = data.taxId;
    this.createdAt = data.createdAt;
  }
}
