import { Controller, Post, Body, Req } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CreateDriverRequestDto } from './dto/create-driver.request.dto';
import { CreateDriverResponseDto } from './dto/create-driver.response.dto';
import { CreateDriverCommand } from '@driver/application/commands/v1/create-driver/create-driver.command';
import { matchResult } from '@common/http/match-result';
import { Audit, AuditContext } from '@shared/infrastructure/decorators/audit-context.decorator';

@ApiTags('Drivers')
@ApiBearerAuth()
@Controller('v1/drivers')
export class CreateDriverController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('create')
  @ApiOperation({ summary: 'Crear un nuevo conductor' })
  @ApiResponse({ status: 201, type: CreateDriverResponseDto })
  async execute(
    @Body() dto: CreateDriverRequestDto,
    @Req() req: any,
    @Audit() audit: AuditContext,
  ) {
    const result = await this.commandBus.execute(
      new CreateDriverCommand(
        dto.tenantId,
        dto.name,
        dto.licenseNumber,
        dto.licenseExpiry,
        dto.dni,
        dto.phoneEmergency,
        req.user?.sub,
        audit.ip,
        audit.userAgent,
      ),
    );

    return matchResult(result, (data) => new CreateDriverResponseDto(data));
  }
}
