import { ApiProperty } from '@nestjs/swagger';

export class CreateUserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  tenantId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  role: string;

  constructor(data: any) {
    this.id = data.id;
    this.tenantId = data.tenantId;
    this.name = data.name;
    this.email = data.email;
    this.role = data.role;
  }
}
