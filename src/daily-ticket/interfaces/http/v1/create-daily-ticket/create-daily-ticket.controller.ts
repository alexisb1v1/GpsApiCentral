import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CreateDailyTicketRequestDto } from '@daily-ticket/application/commands/v1/create-daily-ticket/dto/create-daily-ticket.request.dto';
import { CreateDailyTicketResponseDto } from './dto/create-daily-ticket.response.dto';
import { CreateDailyTicketCommand } from '@daily-ticket/application/commands/v1/create-daily-ticket/create-daily-ticket.command';
import { matchResult } from '@common/http/match-result';
import { Audit, AuditContext } from '@shared/infrastructure/decorators/audit-context.decorator';
import { Roles } from '@shared/infrastructure/decorators/roles.decorator';
import { RolesGuard } from '@shared/infrastructure/guards/roles.guard';

@ApiTags('Daily Tickets')
@ApiBearerAuth()
@Controller('v1/daily-tickets')
export class CreateDailyTicketController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('create')
  @Roles('ADMIN', 'OPERATOR')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Registrar el pago de salida diaria de un vehículo' })
  @ApiResponse({ status: 201, type: CreateDailyTicketResponseDto })
  async execute(
    @Body() dto: CreateDailyTicketRequestDto,
    @Req() req: any,
    @Audit() audit: AuditContext,
  ) {
    const result = await this.commandBus.execute(
      new CreateDailyTicketCommand(
        req.user.tenantId,
        dto.vehicleId,
        req.user.sub,
        dto.driverId || null,
        dto.routeId || null,
        dto.totalAmount,
        dto.adminFee,
        dto.routeFee,
        dto.workDate || null,
        dto.paymentMethod || 'EFECTIVO',
        dto.paymentReference || null,
        dto.direction || 'IDA',
        audit.ip,
        audit.userAgent,
      ),
    );

    return matchResult(result);
  }
}
