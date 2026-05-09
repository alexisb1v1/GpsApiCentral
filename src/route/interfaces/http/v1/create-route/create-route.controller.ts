import { Controller, Post, Body, Ip, Headers, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CreateRouteRequestDto } from './dto/create-route.request.dto';
import { CreateRouteCommand } from '../../../../application/commands/v1/create-route/create-route.command';
import { matchResult } from '../../../../../common/http/match-result';
import { CurrentUser, UserContext } from '../../../../../shared/infrastructure/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../../shared/infrastructure/guards/jwt-auth.guard';

@ApiTags('Route (Gestión de Rutas)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/route')
export class CreateRouteController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('create')
  @ApiOperation({ summary: 'Crear una nueva ruta' })
  @ApiResponse({ status: 201, description: 'Ruta creada exitosamente' })
  async execute(
    @Body() dto: CreateRouteRequestDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @CurrentUser() user: UserContext,
  ) {
    const result = await this.commandBus.execute(
      new CreateRouteCommand(
        dto.name,
        user.tenantId,
        user.userId,
        ip,
        userAgent,
      ),
    );

    return matchResult(result, (route) => ({
      success: true,
      message: 'Ruta creada correctamente',
      data: route,
    }));
  }
}
