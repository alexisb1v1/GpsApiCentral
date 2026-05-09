import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '@shared/infrastructure/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
@Public()
export class HealthCheckController {
  @Get()
  @ApiOperation({ summary: 'Verificar el estado de la aplicación' })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'GpsApiCentral',
    };
  }
}
