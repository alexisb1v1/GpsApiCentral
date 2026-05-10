import { Controller, Post, Body, Req } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CreateVehicleRequestDto } from './dto/create-vehicle.request.dto';
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
  async execute(
    @Body() dto: CreateVehicleRequestDto,
    @Req() req: any,
    @Audit() audit: AuditContext,
  ) {
    const result = await this.commandBus.execute(
      new CreateVehicleCommand(
        dto.tenantId,
        dto.plate,
        dto.brand,
        dto.model,
        dto.year,
        dto.color,
        dto.traccarId,
        req.user.sub,
        audit.ip,
        audit.userAgent,
      ),
    );

    return matchResult(result);
  }
}
