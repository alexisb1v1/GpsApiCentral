import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GetUserByIdQuery } from '@user/application/queries/v1/get-user-by-id/get-user-by-id.query';
import { matchResult } from '@common/http/match-result';
import { CreateUserResponseDto } from '@user/interfaces/http/v1/create-user/dto/create-user.response.dto';

@ApiTags('User')
@Controller('v1/user')
export class GetUserByIdController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalles de un usuario por ID' })
  @ApiResponse({ status: 200, type: CreateUserResponseDto })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async execute(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.queryBus.execute(new GetUserByIdQuery(id));

    return matchResult(
      result,
      (user) => new CreateUserResponseDto(user)
    );
  }
}
