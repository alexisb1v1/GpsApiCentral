import { Controller, Post, Body, Req } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CreateVehicleRequestDto } from './dto/create-vehicle.request.dto';
import { CreateVehicleResponseDto } from './dto/create-vehicle.response.dto';
import { CreateVehicleCommand } from '@vehicle/application/commands/v1/create-vehicle/create-vehicle.command';
import { matchResult } from '@common/http/match-result';
import { Audit, AuditContext } from '@shared/infrastructure/decorators/audit-context.decorator';

@ApiTags('Vehicles')
@ApiBearerAuth()
@Controller('v1/vehicles')
export class CreateVehicleController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('create')
  @ApiOperation({ summary: 'Registrar un nuevo vehículo' })
  @ApiResponse({ status: 201, type: CreateVehicleResponseDto })
  async execute(
    @Body() dto: CreateVehicleRequestDto,
    @Req() req: any,
    @Audit() audit: AuditContext,
  ) {
    const result = await this.commandBus.execute(
      new CreateVehicleCommand(
        dto.plate,
        dto.traccarDeviceId || null,
        dto.brand,
        dto.model,
        dto.year,
        dto.tenantId,
        req.user.sub,
        dto.color,
        audit.ip,
        audit.userAgent,
      ),
    );

    return matchResult(result);
  }
}
