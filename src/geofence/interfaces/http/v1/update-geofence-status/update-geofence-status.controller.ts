import { Controller, Put, Body, Param, Ip, Headers, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UpdateGeofenceStatusRequestDto } from './dto/update-geofence-status.request.dto';
import { UpdateGeofenceStatusCommand } from '../../../../application/commands/v1/update-geofence-status/update-geofence-status.command';
import { matchResult } from '../../../../../common/http/match-result';
import { CurrentUser, UserContext } from '../../../../../shared/infrastructure/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../../shared/infrastructure/guards/jwt-auth.guard';

@ApiTags('Geofence (Puntos de Control)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/geofence')
export class UpdateGeofenceStatusController {
  constructor(private readonly commandBus: CommandBus) {}

  @Put('update-status/:id')
  @ApiOperation({ summary: 'Cambiar el estado de una geocerca' })
  @ApiResponse({ status: 200, description: 'Estado actualizado correctamente' })
  async execute(
    @Param('id') id: string,
    @Body() dto: UpdateGeofenceStatusRequestDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @CurrentUser() user: UserContext,
  ) {
    const result = await this.commandBus.execute(
      new UpdateGeofenceStatusCommand(
        id,
        dto.status,
        user.tenantId,
        user.userId,
        ip,
        userAgent,
      ),
    );

    return matchResult(result, () => ({ success: true, message: 'Estado actualizado correctamente' }));
  }
}
