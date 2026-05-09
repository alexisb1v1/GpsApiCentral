import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GetUsersByTenantQuery } from '@user/application/queries/v1/get-users-by-tenant/get-users-by-tenant.query';
import { matchResult } from '@common/http/match-result';
import { CreateUserResponseDto } from '@user/interfaces/http/v1/create-user/dto/create-user.response.dto';
import { UserEntity } from '@user/domain/entities/user.entity';

@ApiTags('User')
@Controller('v1/user')
export class GetUsersByTenantController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('tenant/:tenantId')
  @ApiOperation({ summary: 'Listar usuarios de un Tenant específico' })
  @ApiResponse({ status: 200, type: [CreateUserResponseDto] })
  async execute(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    const result = await this.queryBus.execute(new GetUsersByTenantQuery(tenantId));

    return matchResult(
      result,
      (users: UserEntity[]) => users.map((u) => new CreateUserResponseDto(u))
    );
  }
}
