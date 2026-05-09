import { Controller, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@auth/infrastructure/guards/jwt-auth.guard';
import { AnnulInfractionDto, AnnulInfractionResponseDto } from './dto/annul-infraction.dto';
import { AnnulInfractionCommand } from '@infraction/application/commands/v1/annul-infraction/annul-infraction.command';
import { matchResult } from '@shared/infrastructure/utils/result-matcher';

@ApiTags('infractions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/infraction')
export class AnnulInfractionController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('annul/:id')
  @ApiOperation({ summary: 'Anular una infracción' })
  @ApiResponse({ status: 200, type: AnnulInfractionResponseDto })
  async annul(
    @Param('id') id: string,
    @Body() dto: AnnulInfractionDto,
    @Req() req: any,
  ) {
    const command = new AnnulInfractionCommand(
      id,
      dto.reason,
      req.user.tenantId,
      req.user.id,
      req.ip,
      req.headers['user-agent'],
    );

    const result = await this.commandBus.execute(command);

    return matchResult(result, {
      ok: () => new AnnulInfractionResponseDto(true, 'Infracción anulada correctamente'),
    });
  }
}
