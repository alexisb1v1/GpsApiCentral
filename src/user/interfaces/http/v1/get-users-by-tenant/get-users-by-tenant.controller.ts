import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { GetUsersByTenantQuery } from '@user/application/queries/v1/get-users-by-tenant/get-users-by-tenant.query';
import { matchResult } from '@common/http/match-result';
import { CreateUserResponseDto } from '@user/interfaces/http/v1/create-user/dto/create-user.response.dto';
import { UserEntity } from '@user/domain/entities/user.entity';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('v1/users')
export class GetUsersByTenantController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(['tenant', 'tenant/:tenantId'])
  @ApiOperation({ summary: 'Listar usuarios de un Tenant específico o todos' })
  @ApiParam({ name: 'tenantId', required: false, description: 'ID del Tenant (Opcional para ver todos)' })
  @ApiResponse({ status: 200, type: [CreateUserResponseDto] })
  async execute(@Param('tenantId') tenantId?: string) {
    const result = await this.queryBus.execute(new GetUsersByTenantQuery(tenantId || ''));

    return matchResult(
      result,
      (users: UserEntity[]) => users.map((u) => new CreateUserResponseDto(u))
    );
  }
}
