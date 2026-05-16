import { Controller, Post, Get, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CreateVehicleDocumentRequestDto } from './dto/create-vehicle-document.request.dto';
import { VehicleDocumentResponseDto } from './dto/vehicle-document.response.dto';
import { CreateVehicleDocumentCommand } from '@vehicle/application/commands/v1/create-vehicle-document/create-vehicle-document.command';
import { DeleteVehicleDocumentCommand } from '@vehicle/application/commands/v1/delete-vehicle-document/delete-vehicle-document.command';
import { GetVehicleDocumentsQuery } from '@vehicle/application/queries/v1/get-vehicle-documents/get-vehicle-documents.query';
import { matchResult } from '@common/http/match-result';
import { Audit, AuditContext } from '@shared/infrastructure/decorators/audit-context.decorator';
import { JwtAuthGuard } from '@shared/infrastructure/guards/jwt-auth.guard';

@ApiTags('Vehicles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/vehicle-documents')
export class VehicleDocumentsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Registrar un documento para un vehículo' })
  @ApiResponse({ status: 201, type: VehicleDocumentResponseDto })
  async create(
    @Body() dto: CreateVehicleDocumentRequestDto,
    @Req() req: any,
    @Audit() audit: AuditContext,
  ) {
    const result = await this.commandBus.execute(
      new CreateVehicleDocumentCommand(
        dto.vehicleId,
        req.user.tenantId,
        dto.documentType,
        dto.documentNumber,
        dto.expirationDate || null,
        dto.notifyExpiration ?? false,
        req.user.sub,
        audit.ip,
        audit.userAgent,
      ),
    );

    return matchResult(result);
  }

  @Get('vehicle/:vehicleId')
  @ApiOperation({ summary: 'Obtener todos los documentos de un vehículo' })
  @ApiResponse({ status: 200, type: [VehicleDocumentResponseDto] })
  async getByVehicle(@Param('vehicleId') vehicleId: string) {
    const result = await this.queryBus.execute(new GetVehicleDocumentsQuery(vehicleId));
    return matchResult(result);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un documento de vehículo' })
  @ApiResponse({ status: 200 })
  async delete(
    @Param('id') id: string,
    @Req() req: any,
    @Audit() audit: AuditContext,
  ) {
    const result = await this.commandBus.execute(
      new DeleteVehicleDocumentCommand(
        id,
        req.user.tenantId,
        req.user.sub,
        audit.ip,
        audit.userAgent,
      ),
    );

    return matchResult(result);
  }
}
