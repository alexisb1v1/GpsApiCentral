import { Controller, Post, Body, Ip, Headers, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CreateGeofenceRequestDto } from '../../../../application/commands/v1/create-geofence/dto/create-geofence.request.dto';
import { CreateGeofenceCommand } from '../../../../application/commands/v1/create-geofence/create-geofence.command';
import { matchResult } from '../../../../../common/http/match-result';
import { CreateGeofenceResponseDto } from './dto/create-geofence.response.dto';
import { CurrentUser, UserContext } from '../../../../../shared/infrastructure/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../../shared/infrastructure/guards/jwt-auth.guard';

@ApiTags('Geofence (Puntos de Control)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/geofence')
export class CreateGeofenceController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('create')
  @ApiOperation({ summary: 'Registrar un punto de control / paradero' })
  @ApiResponse({ status: 201, type: CreateGeofenceResponseDto })
  async execute(
    @Body() dto: CreateGeofenceRequestDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @CurrentUser() user: UserContext,
  ) {
    const result = await this.commandBus.execute(
      new CreateGeofenceCommand(
        user.tenantId,
        dto.traccarGeofenceId,
        dto.name,
        dto.type,
        user.userId,
        ip,
        userAgent,
      ),
    );

    return matchResult(
      result,
      (geofence) => new CreateGeofenceResponseDto(true, 'Geocerca registrada correctamente', geofence),
      {
        ALREADY_EXISTS: 'Esta geocerca de Traccar ya se encuentra registrada para su empresa',
      },
    );
  }
}
