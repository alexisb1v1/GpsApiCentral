import { Controller, Put, Param, Body, Req } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UpdateUserRequestDto } from './dto/update-user.request.dto';
import { UpdateUserCommand } from '@user/application/commands/v1/update-user/update-user.command';
import { matchResult } from '@common/http/match-result';
import { Audit, AuditContext } from '@shared/infrastructure/decorators/audit-context.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('v1/users')
export class UpdateUserController {
  constructor(private readonly commandBus: CommandBus) {}

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar datos de un usuario' })
  async execute(
    @Param('id') id: string,
    @Body() dto: UpdateUserRequestDto,
    @Req() req: any,
    @Audit() audit: AuditContext,
  ) {
    const result = await this.commandBus.execute(
      new UpdateUserCommand(
        id,
        dto.name,
        dto.email,
        dto.role,
        dto.isActive,
        undefined,
        req.user.sub,
        audit.ip,
        audit.userAgent,
      ),
    );

    return matchResult(result);
  }
}
