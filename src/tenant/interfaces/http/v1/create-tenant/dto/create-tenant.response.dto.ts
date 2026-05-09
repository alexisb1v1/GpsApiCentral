export class CreateTenantResponseDto {
  id: string;
  name: string;
  subdomain: string;
  isActive: boolean;
  createdAt: Date;

  constructor(data: any) {
    this.id = data.id;
    this.name = data.name;
    this.subdomain = data.subdomain;
    this.isActive = data.isActive;
    this.createdAt = data.createdAt;
  }
}
