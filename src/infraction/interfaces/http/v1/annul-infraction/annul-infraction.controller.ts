import { Controller, Post, Body, Param, Ip, Headers, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../../shared/infrastructure/guards/jwt-auth.guard';
import { AnnulInfractionDto, AnnulInfractionResponseDto } from './dto/annul-infraction.dto';
import { AnnulInfractionCommand } from '../../../../application/commands/v1/annul-infraction/annul-infraction.command';
import { matchResult } from '../../../../../common/http/match-result';
import { CurrentUser, UserContext } from '../../../../../shared/infrastructure/decorators/current-user.decorator';

@ApiTags('Infracciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/infraction')
export class AnnulInfractionController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('annul/:id')
  @ApiOperation({ summary: 'Anular una infracción' })
  @ApiResponse({ status: 200, type: AnnulInfractionResponseDto })
  @ApiResponse({ status: 404, description: 'Infracción no encontrada' })
  async execute(
    @Param('id') id: string,
    @Body() dto: AnnulInfractionDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @CurrentUser() user: UserContext,
  ) {
    const result = await this.commandBus.execute(
      new AnnulInfractionCommand(
        id,
        dto.reason,
        user.tenantId,
        user.userId,
        ip,
        userAgent,
      ),
    );

    return matchResult(
      result,
      () => new AnnulInfractionResponseDto(true, 'Infracción anulada correctamente'),
      {
        NOT_FOUND: 'La infracción especificada no existe',
        FORBIDDEN: 'No tiene permisos sobre esta infracción',
      },
    );
  }
}
