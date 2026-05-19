import { Controller, Put, Body, Req, Param } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { UpdateDriverRequestDto } from './dto/update-driver.request.dto';
import { UpdateDriverResponseDto } from './dto/update-driver.response.dto';
import { UpdateDriverCommand } from '@driver/application/commands/v1/update-driver/update-driver.command';
import { matchResult } from '@common/http/match-result';
import { Audit, AuditContext } from '@shared/infrastructure/decorators/audit-context.decorator';

@ApiTags('Drivers')
@ApiBearerAuth()
@Controller('v1/drivers')
export class UpdateDriverController {
  constructor(private readonly commandBus: CommandBus) {}

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar un conductor' })
  @ApiResponse({ status: 200, type: UpdateDriverResponseDto })
  async execute(
    @Param('id') id: string,
    @Body() dto: UpdateDriverRequestDto,
    @Req() req: any,
    @Audit() audit: AuditContext,
  ) {
    const result = await this.commandBus.execute(
      new UpdateDriverCommand(
        id,
        dto.name,
        dto.licenseNumber,
        dto.licenseExpiry,
        dto.dni,
        dto.phoneEmergency,
        dto.status,
        req.user?.sub,
        audit.ip,
        audit.userAgent,
      ),
    );

    return matchResult(result, (data) => new UpdateDriverResponseDto(data));
  }
}
