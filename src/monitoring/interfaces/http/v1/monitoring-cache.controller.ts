import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '@shared/infrastructure/decorators/public.decorator';
import { VehicleTenantCache } from '../../../infrastructure/cache/vehicle-tenant.cache';

@ApiTags('Monitoring Cache')
@Controller('v1/monitoring/cache')
@Public() // Permitir acceso público para facilitar la depuración y pruebas rápidas
export class MonitoringCacheController {
  constructor(private readonly vehicleTenantCache: VehicleTenantCache) {}

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Forzar el reinicio e hidratación en caliente de la caché en memoria de vehículos y tickets' })
  @ApiResponse({ status: 200, description: 'Caché reiniciada e hidratada exitosamente' })
  async resetCache() {
    await this.vehicleTenantCache.resetCache();
    return {
      status: 'success',
      message: 'Caché de monitoreo (vehículos y tickets activos) reiniciada e hidratada exitosamente.',
      timestamp: new Date().toISOString(),
    };
  }
}
