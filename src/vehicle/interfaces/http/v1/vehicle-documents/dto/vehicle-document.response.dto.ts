import { ApiProperty } from '@nestjs/swagger';

export class VehicleDocumentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  vehicleId: string;

  @ApiProperty()
  documentType: string;

  @ApiProperty()
  documentNumber: string;

  @ApiProperty({ required: false })
  expirationDate: Date | null;

  @ApiProperty()
  notifyExpiration: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
