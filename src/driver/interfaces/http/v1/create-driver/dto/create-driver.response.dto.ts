import { ApiProperty } from '@nestjs/swagger';

export class DriverInfoResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  licenseNumber: string;

  @ApiProperty()
  licenseExpiry: Date;

  @ApiProperty()
  dni: string;

  @ApiProperty()
  phoneEmergency: string | null;

  @ApiProperty()
  status: string;

  constructor(data: any) {
    this.id = data.id;
    this.licenseNumber = data.licenseNumber;
    this.licenseExpiry = data.licenseExpiry;
    this.dni = data.dni;
    this.phoneEmergency = data.phoneEmergency;
    this.status = data.status;
  }
}

export class CreateDriverResponseDto {
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

  @ApiProperty()
  status: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: DriverInfoResponseDto })
  driverInfo: DriverInfoResponseDto | null;

  constructor(data: any) {
    this.id = data.id;
    this.tenantId = data.tenantId;
    this.name = data.name;
    this.email = data.email;
    this.role = data.role;
    this.status = data.status;
    this.createdAt = data.createdAt;
    this.driverInfo = data.driverInfo ? new DriverInfoResponseDto(data.driverInfo) : null;
  }
}
