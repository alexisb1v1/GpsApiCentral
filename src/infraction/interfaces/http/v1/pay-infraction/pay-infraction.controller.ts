import { Controller, Post, Param, Ip, Headers, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../../shared/infrastructure/guards/jwt-auth.guard';
import { PayInfractionCommand } from '../../../../application/commands/v1/pay-infraction/pay-infraction.command';
import { PayInfractionResponseDto } from './dto/pay-infraction.response.dto';
import { matchResult } from '../../../../../common/http/match-result';
import { CurrentUser, UserContext } from '../../../../../shared/infrastructure/decorators/current-user.decorator';

@ApiTags('Infracciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/infraction')
export class PayInfractionController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('pay/:id')
  @ApiOperation({ summary: 'Pagar una infracción' })
  @ApiResponse({ status: 200, type: PayInfractionResponseDto })
  @ApiResponse({ status: 404, description: 'Infracción no encontrada' })
  async execute(
    @Param('id') id: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @CurrentUser() user: UserContext,
  ) {
    const result = await this.commandBus.execute(
      new PayInfractionCommand(
        id,
        user.tenantId,
        user.userId,
        undefined, // paymentId opcional por ahora
        ip,
        userAgent,
      ),
    );

    return matchResult(
      result,
      () => new PayInfractionResponseDto(true, 'Infracción pagada correctamente'),
      {
        NOT_FOUND: 'La infracción especificada no existe',
        FORBIDDEN: 'No tiene permisos sobre esta infracción',
      },
    );
  }
}
