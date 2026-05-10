import { Controller, Post, Body, Req } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CreateDailyTicketRequestDto } from './dto/create-daily-ticket.request.dto';
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
        dto.vehicleId,
        dto.workDate,
        dto.amount,
        req.user.sub,
        audit.ip,
        audit.userAgent,
      ),
    );

    return matchResult(result);
  }
}
