import { Controller, Delete, Param, Req } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SoftDeleteUserCommand } from '@user/application/commands/v1/soft-delete-user/soft-delete-user.command';
import { matchResult } from '@common/http/match-result';
import { Audit, AuditContext } from '@shared/infrastructure/decorators/audit-context.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('v1/users')
export class SoftDeleteUserController {
  constructor(private readonly commandBus: CommandBus) { }

  @Delete(':id')
  @ApiOperation({ summary: 'Desactivar un usuario (Soft Delete)' })
  async execute(
    @Param('id') id: string,
    @Req() req: any,
    @Audit() audit: AuditContext,
  ) {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.sub;

    const result = await this.commandBus.execute(
      new SoftDeleteUserCommand(
        id,
        tenantId,
        userId,
        audit.ip,
        audit.userAgent,
      ),
    );

    return matchResult(result);
  }
}
