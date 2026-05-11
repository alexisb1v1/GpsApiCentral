export class CreateTenantResponseDto {
  id: string;
  name: string;
  subdomain: string;
  isActive: boolean;
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  statusDotColor: string | null;
  createdAt: Date;

  constructor(data: any) {
    this.id = data.id;
    this.name = data.name;
    this.subdomain = data.subdomain;
    this.isActive = data.isActive;
    this.logoUrl = data.logoUrl;
    this.primaryColor = data.primaryColor;
    this.accentColor = data.accentColor;
    this.statusDotColor = data.statusDotColor;
    this.createdAt = data.createdAt;
  }
}
