import { Controller, Post, Body, Req } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CreateUserRequestDto } from './dto/create-user.request.dto';
import { CreateUserCommand } from '@user/application/commands/v1/create-user/create-user.command';
import { matchResult } from '@common/http/match-result';
import { Audit, AuditContext } from '@shared/infrastructure/decorators/audit-context.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('v1/users')
export class CreateUserController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('create')
  @ApiOperation({ summary: 'Crear un nuevo usuario' })
  async execute(
    @Body() dto: CreateUserRequestDto,
    @Req() req: any,
    @Audit() audit: AuditContext,
  ) {
    const result = await this.commandBus.execute(
      new CreateUserCommand(
        dto.tenantId,
        dto.name,
        dto.email,
        dto.password,
        dto.role,
        req.user.sub,
        audit.ip,
        audit.userAgent,
      ),
    );

    return matchResult(result);
  }
}
