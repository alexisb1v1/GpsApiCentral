import { Controller, Post, Body, Req } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CreateRouteRequestDto } from './dto/create-route.request.dto';
import { CreateRouteCommand } from '@route/application/commands/v1/create-route/create-route.command';
import { matchResult } from '@common/http/match-result';
import { Audit, AuditContext } from '@shared/infrastructure/decorators/audit-context.decorator';

@ApiTags('Routes')
@ApiBearerAuth()
@Controller('v1/routes')
export class CreateRouteController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('create')
  @ApiOperation({ summary: 'Registrar una nueva ruta' })
  async execute(
    @Body() dto: CreateRouteRequestDto,
    @Req() req: any,
    @Audit() audit: AuditContext,
  ) {
    const result = await this.commandBus.execute(
      new CreateRouteCommand(
        dto.tenantId,
        dto.name,
        dto.description,
        req.user.sub,
        audit.ip,
        audit.userAgent,
      ),
    );

    return matchResult(result);
  }
}
