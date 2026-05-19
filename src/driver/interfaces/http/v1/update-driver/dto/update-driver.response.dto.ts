import { ApiProperty } from '@nestjs/swagger';
import { DriverInfoResponseDto } from '../../create-driver/dto/create-driver.response.dto';

export class UpdateDriverResponseDto {
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
