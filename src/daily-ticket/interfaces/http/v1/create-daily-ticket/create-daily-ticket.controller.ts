import { Controller, Post, Body, Ip, Headers, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CreateDailyTicketRequestDto } from '../../../../application/commands/v1/create-daily-ticket/dto/create-daily-ticket.request.dto';
import { CreateDailyTicketCommand } from '../../../../application/commands/v1/create-daily-ticket/create-daily-ticket.command';
import { matchResult } from '../../../../../common/http/match-result';
import { CreateDailyTicketResponseDto } from './dto/create-daily-ticket.response.dto';
import { CurrentUser, UserContext } from '../../../../../shared/infrastructure/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../../shared/infrastructure/guards/jwt-auth.guard';

@ApiTags('Daily Tickets (Salidas)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/daily-ticket')
export class CreateDailyTicketController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('create')
  @ApiOperation({ summary: 'Registrar el pago de salida diaria de un vehículo' })
  @ApiResponse({ status: 201, description: 'Ticket registrado exitosamente', type: CreateDailyTicketResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos o ya existe ticket para el día' })
  async execute(
    @Body() dto: CreateDailyTicketRequestDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @CurrentUser() user: UserContext,
  ) {
    const result = await this.commandBus.execute(
      new CreateDailyTicketCommand(
        user.tenantId,
        dto.vehicleId,
        user.userId,
        dto.routeId || null,
        dto.totalAmount,
        dto.adminFee,
        dto.routeFee,
        dto.workDate || null,
        ip,
        userAgent,
      ),
    );

    return matchResult(
      result,
      (ticket) => new CreateDailyTicketResponseDto(true, 'Ticket de salida registrado correctamente', ticket),
      {
        ALREADY_EXISTS: 'El vehículo ya tiene un ticket de salida registrado para esta fecha',
        NOT_FOUND: 'El vehículo especificado no existe',
        FORBIDDEN: 'No tiene permisos sobre este vehículo',
      },
    );
  }
}
