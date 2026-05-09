import { Controller, Put, Body, Param, Ip, Headers, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UpdateRouteStopsRequestDto } from './dto/update-route-stops.request.dto';
import { UpdateRouteStopsCommand } from '../../../../application/commands/v1/update-route-stops/update-route-stops.command';
import { matchResult } from '../../../../../common/http/match-result';
import { CurrentUser, UserContext } from '../../../../../shared/infrastructure/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../../shared/infrastructure/guards/jwt-auth.guard';

@ApiTags('Route (Gestión de Rutas)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/route')
export class UpdateRouteStopsController {
  constructor(private readonly commandBus: CommandBus) {}

  @Put('update-stops/:id')
  @ApiOperation({ summary: 'Actualizar la secuencia de paraderos de una ruta' })
  @ApiResponse({ status: 200, description: 'Paraderos actualizados exitosamente' })
  async execute(
    @Param('id') id: string,
    @Body() dto: UpdateRouteStopsRequestDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @CurrentUser() user: UserContext,
  ) {
    const result = await this.commandBus.execute(
      new UpdateRouteStopsCommand(
        id,
        dto.stops,
        user.tenantId,
        user.userId,
        ip,
        userAgent,
      ),
    );

    return matchResult(result, () => ({
      success: true,
      message: 'Paraderos de la ruta actualizados correctamente',
    }));
  }
}
