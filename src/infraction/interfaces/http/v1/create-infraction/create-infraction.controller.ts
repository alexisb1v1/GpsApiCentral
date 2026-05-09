import { Controller, Post, Body, Ip, Headers, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CreateInfractionRequestDto } from '../../../../application/commands/v1/create-infraction/dto/create-infraction.request.dto';
import { CreateInfractionCommand } from '../../../../application/commands/v1/create-infraction/create-infraction.command';
import { matchResult } from '../../../../../common/http/match-result';
import { CreateInfractionResponseDto } from './dto/create-infraction.response.dto';
import { CurrentUser, UserContext } from '../../../../../shared/infrastructure/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../../auth/infrastructure/guards/jwt-auth.guard';

@ApiTags('Infraction')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/infraction')
export class CreateInfractionController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @ApiOperation({ summary: 'Registrar una nueva infracción' })
  @ApiResponse({ status: 201, description: 'Infracción registrada exitosamente', type: CreateInfractionResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Vehículo no encontrado' })
  async execute(
    @Body() dto: CreateInfractionRequestDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @CurrentUser() user: UserContext,
  ) {
    const result = await this.commandBus.execute(
      new CreateInfractionCommand(
        dto.vehicleId,
        dto.type,
        dto.amount,
        user.tenantId,
        user.userId,
        ip,
        userAgent,
        dto.description,
      ),
    );

    return matchResult(
      result,
      (infraction) => new CreateInfractionResponseDto(true, 'Infracción registrada correctamente', infraction),
      {
        VEHICLE_NOT_FOUND: 'El vehículo especificado no existe o no pertenece a su empresa',
      },
    );
  }
}
