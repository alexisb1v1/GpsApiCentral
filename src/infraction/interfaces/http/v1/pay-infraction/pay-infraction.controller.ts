import { Controller, Post, Param, UseGuards, Req } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@shared/infrastructure/guards/jwt-auth.guard';
import { PayInfractionCommand } from '../../../../application/commands/v1/pay-infraction/pay-infraction.command';
import { PayInfractionResponseDto } from './dto/pay-infraction.response.dto';
import { Result } from 'neverthrow';
import { AppError } from '@shared/domain/errors/app-errors';
import { Request } from 'express';

@ApiTags('Infracciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/infraction')
export class PayInfractionController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('pay/:id')
  @ApiOperation({ summary: 'Pagar una infracción' })
  @ApiResponse({ status: 200, type: PayInfractionResponseDto })
  async pay(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<PayInfractionResponseDto> {
    const user = req.user as any;
    
    const command = new PayInfractionCommand(
      id,
      user.tenantId,
      user.id,
      undefined, // paymentId opcional por ahora
      req.ip,
      req.headers['user-agent'],
    );

    const result: Result<boolean, AppError> = await this.commandBus.execute(command);

    if (result.isErr()) {
      throw result.error; // El interceptor global manejará esto
    }

    return new PayInfractionResponseDto(true, 'Infracción pagada correctamente');
  }
}
