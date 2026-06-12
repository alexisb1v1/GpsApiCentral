import { Controller, Post, Get, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '@shared/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@shared/infrastructure/guards/roles.guard';
import { Roles } from '@shared/infrastructure/decorators/roles.decorator';
import { VehicleTenantCache } from '../../../infrastructure/cache/vehicle-tenant.cache';

export class ResetCacheRequestDto {
  @ApiProperty({ default: false, description: 'Si es true, desvincula los dispositivos de sus rutas en Traccar (groupId: 0)' })
  @IsBoolean()
  @IsOptional()
  unlinkDevices?: boolean;
}

@ApiTags('Monitoring Cache')
@ApiBearerAuth()
@Controller('v1/monitoring/cache')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class MonitoringCacheController {
  constructor(private readonly vehicleTenantCache: VehicleTenantCache) {}

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Forzar el reinicio e hidratación en caliente de la caché en memoria de vehículos y tickets' })
  @ApiResponse({ status: 200, description: 'Caché reiniciada e hidratada exitosamente' })
  async resetCache(@Body() body: ResetCacheRequestDto) {
    const unlink = body.unlinkDevices ?? false;
    await this.vehicleTenantCache.resetCache({ unlinkDevices: unlink });
    return {
      status: 'success',
      message: unlink
        ? 'Caché de monitoreo reiniciada exitosamente. Dispositivos desvinculados de sus rutas en Traccar.'
        : 'Caché de monitoreo reiniciada exitosamente. Los dispositivos continúan vinculados a sus rutas.',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener la previsualización de diagnóstico legible de la caché en caliente' })
  @ApiResponse({ status: 200, description: 'Previsualización de la caché obtenida de forma exitosa' })
  async getCacheStatus() {
    const data = await this.vehicleTenantCache.getCacheStatus();
    return {
      status: 'success',
      data,
      timestamp: new Date().toISOString(),
    };
  }
}
