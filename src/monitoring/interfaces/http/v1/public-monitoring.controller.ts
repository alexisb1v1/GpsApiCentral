import { Controller, Get, Param, Req, HttpCode, HttpStatus, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '@shared/infrastructure/decorators/public.decorator';
import { TenantEntity } from '@tenant/domain/entities/tenant.entity';
import { RouteEntity } from '@route/domain/entities/route.entity';
import { VehicleTenantCache } from '../../../infrastructure/cache/vehicle-tenant.cache';
import { PublicTenantDomainsResponseDto } from './dto/public-tenant-domains.response.dto';

@ApiTags('Public Monitoring')
@Controller('v1/public/monitoring')
@Public() // Endpoint 100% público para ser embebido / consumido desde el exterior
export class PublicMonitoringController {
  private readonly logger = new Logger(PublicMonitoringController.name);

  constructor(
    @InjectRepository(TenantEntity)
    private readonly tenantRepository: Repository<TenantEntity>,
    @InjectRepository(RouteEntity)
    private readonly routeRepository: Repository<RouteEntity>,
    private readonly vehicleTenantCache: VehicleTenantCache,
  ) {}

  @Get(':tenantSlug/allowed-domains')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener los dominios autorizados de un tenant para CSP frame-ancestors' })
  @ApiResponse({ status: 200, description: 'Dominios permitidos cargados exitosamente' })
  async getTenantAllowedDomains(@Param('tenantSlug') tenantSlug: string): Promise<PublicTenantDomainsResponseDto> {
    const tenant = await this.tenantRepository.findOne({
      where: { subdomain: tenantSlug, isActive: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant con subdominio/slug "${tenantSlug}" no encontrado o inactivo.`);
    }

    return new PublicTenantDomainsResponseDto(tenant.subdomain, tenant.allowedDomains);
  }

  @Get(':tenantSlug')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener la configuración, rutas y posiciones en tiempo real para el widget público del tenant' })
  @ApiResponse({ status: 200, description: 'Datos del widget público consolidados exitosamente' })
  async getPublicWidgetData(
    @Param('tenantSlug') tenantSlug: string,
    @Req() request: Request,
  ) {
    // 1. Buscar tenant inactivo o inexistente
    const tenant = await this.tenantRepository.findOne({
      where: { subdomain: tenantSlug, isActive: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant con subdominio/slug "${tenantSlug}" no encontrado o inactivo.`);
    }

    // 2. Validación de orígenes por cabeceras HTTP (Referer / Origin) contra allowedDomains en DB
    this.validateRequestOrigin(tenant, request);

    // 3. Obtener todas las rutas activas del tenant e incluir paraderos (stops)
    const routes = await this.routeRepository.find({
      where: { tenantId: tenant.id, isActive: true },
      relations: ['stops'],
      order: {
        createdAt: 'ASC',
      },
    });

    // 4. Obtener las coordenadas del posicionamiento en tiempo real desde la caché
    const allPositions = this.vehicleTenantCache.getLatestPositionsByTenant(tenant.id);

    // 5. Filtrar estrictamente: solo vehículos con tickets del día activos y pagados (dailyTicketId no nulo)
    const activeVehicles = allPositions.filter(pos => pos.dailyTicketId !== null);

    return {
      success: true,
      tenantId: tenant.id,
      tenantName: tenant.name,
      primaryColor: tenant.primaryColor || '#16a34a',
      accentColor: tenant.accentColor || '#15803d',
      logoUrl: tenant.logoUrl,
      routes: routes.map(route => ({
        id: route.id,
        name: route.name,
        outboundCoordinates: route.outboundCoordinates || [],
        inboundCoordinates: route.inboundCoordinates || [],
        stops: (route.stops || [])
          .filter(stop => stop.coordinates && stop.coordinates.length > 0)
          .map(stop => ({
            id: stop.id,
            name: stop.name || `Paradero ${stop.stopOrder}`,
            type: stop.type,
            stopOrder: stop.stopOrder,
            direction: stop.direction,
            coordinates: stop.coordinates,
          }))
          .sort((a, b) => a.stopOrder - b.stopOrder),
      })),
      vehicles: activeVehicles.map(vehicle => ({
        vehicleId: vehicle.vehicleId,
        plate: vehicle.plate,
        routeId: vehicle.routeId,
        direction: vehicle.direction,
        lat: vehicle.latitude || vehicle.lat, // Soporta ambos esquemas de atributos
        lng: vehicle.longitude || vehicle.lng,
        speed: vehicle.speed || 0,
        course: vehicle.course || 0,
        lastUpdate: vehicle.deviceTime || vehicle.lastUpdate || new Date().toISOString(),
      })),
    };
  }

  /**
   * Helper robusto para validar cabeceras HTTP de origen contra la base de datos
   */
  private validateRequestOrigin(tenant: TenantEntity, request: Request): void {
    // Si no hay dominios restringidos configurados en el tenant, permitir por defecto
    if (!tenant.allowedDomains || tenant.allowedDomains.trim() === '') {
      return;
    }

    const referer = request.headers['referer'] as string | undefined;
    const origin = request.headers['origin'] as string | undefined;

    // Dominios autorizados en la BD
    const allowedList = tenant.allowedDomains
      .split(',')
      .map(domain => domain.trim().toLowerCase())
      .filter(domain => domain !== '');

    if (allowedList.length === 0) {
      return;
    }

    // Helper para verificar si un host de origen está en la lista de permitidos
    const checkMatch = (sourceUrl: string): boolean => {
      try {
        const parsedUrl = new URL(sourceUrl);
        const originDomain = parsedUrl.origin.toLowerCase(); // ej: "https://transportesanjuan.com"
        const hostname = parsedUrl.hostname.toLowerCase(); // ej: "transportesanjuan.com"

        return allowedList.some(allowedPattern => {
          // Si es coincidencia exacta de origen o hostname
          if (allowedPattern === originDomain || allowedPattern === hostname) {
            return true;
          }

          // Soporte para patrones comodín básicos como "*.centralafbv.com"
          if (allowedPattern.startsWith('*.')) {
            const domainSuffix = allowedPattern.slice(2);
            return hostname.endsWith(domainSuffix);
          }

          // Soporte para dominios con puertos o protocolos relativos
          try {
            const parsedAllowed = new URL(allowedPattern);
            return parsedAllowed.hostname === hostname;
          } catch {
            return allowedPattern.includes(hostname) || hostname.includes(allowedPattern);
          }
        });
      } catch (err) {
        return false;
      }
    };

    // Validar con Referer u Origin
    let isAuthorized = false;

    if (origin && checkMatch(origin)) {
      isAuthorized = true;
    } else if (referer && checkMatch(referer)) {
      isAuthorized = true;
    }

    // Permitir acceso desde localhost en entornos de desarrollo local
    const isLocalhost = (url: string | undefined) => 
      url && (url.includes('localhost') || url.includes('127.0.0.1') || url.includes('[::1]'));

    if (!isAuthorized && (isLocalhost(origin) || isLocalhost(referer))) {
      this.logger.warn(`Petición local permitida temporalmente en desarrollo: Origin=${origin}, Referer=${referer}`);
      isAuthorized = true;
    }

    if (!isAuthorized) {
      this.logger.warn(
        `Acceso no autorizado al mapa público del tenant ${tenant.subdomain}. Referer: ${referer}, Origin: ${origin}. Dominios permitidos: ${tenant.allowedDomains}`
      );
      throw new ForbiddenException('Acceso no autorizado: Dominio de origen no permitido para este mapa público.');
    }
  }
}
