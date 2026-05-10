import { Controller, Post, Body, Req } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CreateDailyTicketRequestDto } from '@daily-ticket/application/commands/v1/create-daily-ticket/dto/create-daily-ticket.request.dto';
import { CreateDailyTicketCommand } from '@daily-ticket/application/commands/v1/create-daily-ticket/create-daily-ticket.command';
import { matchResult } from '@common/http/match-result';
import { Audit, AuditContext } from '@shared/infrastructure/decorators/audit-context.decorator';

@ApiTags('Daily Tickets (Salidas)')
@ApiBearerAuth()
@Controller('v1/daily-ticket')
export class CreateDailyTicketController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('create')
  @ApiOperation({ summary: 'Registrar el pago de salida diaria de un vehículo' })
  async execute(
    @Body() dto: CreateDailyTicketRequestDto,
    @Req() req: any,
    @Audit() audit: AuditContext,
  ) {
    const result = await this.commandBus.execute(
      new CreateDailyTicketCommand(
        req.user.tenantId || dto.vehicleId, // Usamos el tenant del usuario o el que corresponda
        dto.vehicleId,
        req.user.sub,
        dto.routeId || null,
        dto.totalAmount,
        dto.adminFee,
        dto.routeFee,
        dto.workDate || null,
        audit.ip,
        audit.userAgent,
      ),
    );

    return matchResult(result);
  }
}
