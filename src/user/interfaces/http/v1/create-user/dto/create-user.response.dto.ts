export class CreateUserResponseDto {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: string;

  constructor(data: any) {
    this.id = data.id;
    this.tenantId = data.tenantId;
    this.name = data.name;
    this.email = data.email;
    this.role = data.role;
  }
}
