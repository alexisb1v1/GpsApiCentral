import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayInit } from '@nestjs/websockets';
import { OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Subscription } from 'rxjs';
import { TenantEntity } from '@tenant/domain/entities/tenant.entity';
import { TraccarSocketService } from '../../infrastructure/traccar/traccar-socket.service';
import { VehicleTenantCache } from '../../infrastructure/cache/vehicle-tenant.cache';
import { DriverGateway } from './driver.gateway';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class MonitoringGateway implements OnGatewayConnection, OnGatewayInit, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MonitoringGateway.name);
  private traccarSubscription: Subscription | null = null;
  private cacheSubscription: Subscription | null = null;

  @WebSocketServer()
  server: Server;

  constructor(
    @InjectRepository(TenantEntity)
    private readonly tenantRepository: Repository<TenantEntity>,
    private readonly jwtService: JwtService,
    private readonly traccarSocketService: TraccarSocketService,
    private readonly vehicleTenantCache: VehicleTenantCache,
    private readonly driverGateway: DriverGateway,
  ) {}

  afterInit(server: Server) {
    this.logger.log('Gateway de Monitoreo Socket.io inicializado de forma exitosa.');
  }

  onModuleInit() {
    this.subscribeToTraccarPositions();
    this.subscribeToCacheUpdates();
  }

  onModuleDestroy() {
    if (this.traccarSubscription) {
      this.traccarSubscription.unsubscribe();
    }
    if (this.cacheSubscription) {
      this.cacheSubscription.unsubscribe();
    }
  }

  /**
   * Maneja las conexiones entrantes del Frontend y aplica validaciones estrictas
   */
  async handleConnection(socket: Socket) {
    try {
      this.logger.log(`[Socket.io] Nueva petición de conexión desde cliente: ${socket.id}`);

      // 1. Extraer JWT (Soporta query string, auth payload y headers)
      let token = socket.handshake.auth?.token || 
                  socket.handshake.headers?.authorization || 
                  socket.handshake.query?.token;

      const publicTenantSlug = socket.handshake.query?.publicTenantSlug as string | undefined;

      if (Array.isArray(token)) {
        token = token[0];
      }

      if (token && token.startsWith('Bearer ')) {
        token = token.slice(7);
      }

      // CASO A: Conexión Pública Anónima (Widget Embebido)
      if (!token && publicTenantSlug) {
        this.logger.log(`[Socket.io] Conexión pública anónima solicitada para slug "${publicTenantSlug}"`);

        const tenant = await this.tenantRepository.findOne({
          where: { subdomain: publicTenantSlug, isActive: true },
        });

        if (!tenant) {
          this.logger.warn(`[Socket.io] Conexión pública rechazada para ${socket.id}: Tenant "${publicTenantSlug}" inactivo o no existe.`);
          socket.disconnect();
          return;
        }

        // Validar origen (Referer / Origin del handshake) contra allowedDomains en DB
        const isOriginValid = this.validateSocketOrigin(tenant, socket);
        if (!isOriginValid) {
          this.logger.warn(`[Socket.io] Conexión pública rechazada para ${socket.id}: Origen no autorizado para tenant ${tenant.subdomain}.`);
          socket.disconnect();
          return;
        }

        // Vincular socket a la sala pública
        socket['tenantId'] = tenant.id;
        socket['isPublic'] = true;
        await socket.join(`public-tenant:${tenant.id}`);

        this.logger.log(`[Socket.io] Cliente público ${socket.id} conectado con éxito al Tenant "${tenant.name}". Sala unida.`);

        // Emitir posiciones iniciales sanitizadas (solo despachadas)
        const activePositions = await this.vehicleTenantCache.getLatestPositionsByTenant(tenant.id);
        
        if (activePositions.length > 0) {
          // Mapeamos para el formato que espera el widget público
          const formattedPositions = activePositions.map(vehicle => ({
            vehicleId: vehicle.vehicleId,
            plate: vehicle.plate,
            routeId: vehicle.routeId,
            direction: vehicle.direction,
            lat: vehicle.latitude || vehicle.lat,
            lng: vehicle.longitude || vehicle.lng,
            speed: vehicle.speed || 0,
            course: vehicle.course || 0,
            lastUpdate: vehicle.deviceTime || vehicle.lastUpdate || new Date().toISOString(),
          }));
          socket.emit('positions', formattedPositions);
        }
        return;
      }

      // CASO B: Conexión Autenticada Privada (Dashboard Administrativo)
      if (!token) {
        this.logger.warn(`[Socket.io] Conexión rechazada para ${socket.id}: No se envió ningún token JWT.`);
        socket.disconnect();
        return;
      }

      // 2. Validar JWT de forma asíncrona
      const payload = await this.jwtService.verifyAsync(token);
      if (!payload || !payload.tenantId) {
        this.logger.warn(`[Socket.io] Conexión rechazada para ${socket.id}: Token JWT inválido o malformado.`);
        socket.disconnect();
        return;
      }

      const tenantId = payload.tenantId;

      // 3. Vincular el socket a la sala única de su tenant
      socket['tenantId'] = tenantId;
      socket['isPublic'] = false;
      await socket.join(`tenant:${tenantId}`);
      
      this.logger.log(`[Socket.io] Cliente ${socket.id} autenticado con éxito para Tenant: "${tenantId}". Unido a la sala.`);

      // 4. State Cache: Emitir instantáneamente las últimas posiciones conocidas del tenant (evento positions)
      const initialPositions = await this.vehicleTenantCache.getLatestPositionsByTenant(tenantId);
      if (initialPositions.length > 0) {
        socket.emit('positions', initialPositions);
        this.logger.log(`[Socket.io] Latencia Cero: Enviadas ${initialPositions.length} posiciones iniciales en caliente al cliente ${socket.id}`);
      }

    } catch (error: any) {
      this.logger.error(`[Socket.io] Excepción al establecer conexión en cliente ${socket.id}: ${error.message}`);
      socket.disconnect();
    }
  }

  /**
   * Helper para validar el origen del handshake en Socket.io contra allowedDomains
   */
  private validateSocketOrigin(tenant: TenantEntity, socket: Socket): boolean {
    if (!tenant.allowedDomains || tenant.allowedDomains.trim() === '') {
      return true;
    }

    const referer = socket.handshake.headers['referer'] as string | undefined;
    const origin = socket.handshake.headers['origin'] as string | undefined;

    const allowedList = tenant.allowedDomains
      .split(',')
      .map(domain => domain.trim().toLowerCase())
      .filter(domain => domain !== '');

    if (allowedList.length === 0) {
      return true;
    }

    const checkMatch = (sourceUrl: string): boolean => {
      try {
        const parsedUrl = new URL(sourceUrl);
        const originDomain = parsedUrl.origin.toLowerCase();
        const hostname = parsedUrl.hostname.toLowerCase();

        return allowedList.some(allowedPattern => {
          if (allowedPattern === originDomain || allowedPattern === hostname) {
            return true;
          }
          if (allowedPattern.startsWith('*.')) {
            const domainSuffix = allowedPattern.slice(2);
            return hostname.endsWith(domainSuffix);
          }
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

    let isAuthorized = false;

    if (origin && checkMatch(origin)) {
      isAuthorized = true;
    } else if (referer && checkMatch(referer)) {
      isAuthorized = true;
    }

    // Permitir localhost en desarrollo
    const isLocalhost = (url: string | undefined) => 
      url && (url.includes('localhost') || url.includes('127.0.0.1') || url.includes('[::1]'));

    if (!isAuthorized && (isLocalhost(origin) || isLocalhost(referer))) {
      this.logger.warn(`[Socket.io] Origen local permitido en desarrollo: Origin=${origin}, Referer=${referer}`);
      isAuthorized = true;
    }

    return isAuthorized;
  }

  /**
   * Se suscribe al stream reactivo de Traccar y retransmite de forma enriquecida y aislada a cada sala
   */
  private subscribeToTraccarPositions() {
    this.traccarSubscription = this.traccarSocketService.positions$.subscribe({
      next: async (positions) => {
        try {
          // Agrupamos las posiciones enriquecidas por tenantId para emitir de forma eficiente en ráfagas
          const positionsByTenant = new Map<string, any[]>();

          for (const pos of positions) {
            if (!pos.deviceId) continue;

            // 1. Actualizar el State Cache en memoria con la última posición del vehículo
            await this.vehicleTenantCache.updateLastPosition(pos.deviceId, pos);

            const state = await this.vehicleTenantCache.getVehicleState(pos.deviceId);
            if (!state) {
              // El vehículo no está registrado o no cuenta con traccarDeviceId mapeado en la caché
              continue;
            }

            // Construir payload de posición enriquecido para el Frontend
            const enrichedPosition = {
              ...pos,
              vehicleId: state.vehicleId,
              plate: state.plate,
              driverName: state.driverName,
              driverId: state.driverId, // ID único del conductor
              routeId: state.routeId, // ID de la ruta
              direction: state.direction, // Dirección (IDA/VUELTA)
              dailyTicketId: state.dailyTicketId, // UUID o null (unidades sin pagar/"piratas")
              hasActiveTicket: !!state.dailyTicketId,
              roundId: state.roundId || null,
              roundStatus: state.roundStatus || null,
            };

            // Si el vehículo tiene un conductor asignado, retransmitir al canal virtual de choferes en tiempo real
            if (state.driverId) {
              this.driverGateway.emitPositionToDriver(state.driverId, enrichedPosition);
            }

            const tenantGroup = positionsByTenant.get(state.tenantId) || [];
            tenantGroup.push(enrichedPosition);
            positionsByTenant.set(state.tenantId, tenantGroup);
          }

          // Emitir a cada sala de tenant las posiciones satelitales que les pertenecen
          positionsByTenant.forEach((tenantPositions, tenantId) => {
            this.server.to(`tenant:${tenantId}`).emit('positions', tenantPositions);
            
            // Emitir a la sala pública las posiciones sanitizadas (solo despachados con ticket)
            const publicPositions = tenantPositions
              .filter(pos => pos.dailyTicketId !== null)
              .map(pos => ({
                vehicleId: pos.vehicleId,
                plate: pos.plate,
                routeId: pos.routeId,
                direction: pos.direction,
                lat: pos.latitude || pos.lat,
                lng: pos.longitude || pos.lng,
                speed: pos.speed || 0,
                course: pos.course || 0,
                lastUpdate: pos.deviceTime || pos.lastUpdate || new Date().toISOString(),
              }));

            if (publicPositions.length > 0) {
              this.server.to(`public-tenant:${tenantId}`).emit('positions', publicPositions);
            }
            
            // Log ligero de telemetría (opcional, útil para validaciones iniciales)
            this.logger.debug(`Emitidas ${tenantPositions.length} posiciones satelitales a sala "tenant:${tenantId}" y ${publicPositions.length} a sala "public-tenant:${tenantId}"`);
          });

        } catch (error: any) {
          this.logger.error(`Error al procesar y retransmitir posiciones en tiempo real: ${error.message}`);
        }
      },
      error: (err) => {
        this.logger.error(`Error crítico en el stream de posiciones satelitales: ${err.message}`);
      },
    });
  }

  /**
   * Se suscribe a las actualizaciones en caliente de la caché (DailyTickets) y notifica a las salas correspondientes
   */
  private subscribeToCacheUpdates() {
    this.cacheSubscription = this.vehicleTenantCache.cacheUpdates$.subscribe({
      next: ({ vehicleId, state }) => {
        try {
          if (state.lastPosition) {
            const enrichedPosition = {
              ...state.lastPosition,
              vehicleId: state.vehicleId,
              plate: state.plate,
              driverName: state.driverName,
              driverId: state.driverId,
              routeId: state.routeId,
              direction: state.direction,
              dailyTicketId: state.dailyTicketId,
              hasActiveTicket: !!state.dailyTicketId,
            };
            
            // Emitir en ráfaga (arreglo de un elemento) para mantener compatibilidad
            this.server.to(`tenant:${state.tenantId}`).emit('positions', [enrichedPosition]);
            
            // Emitir en caliente a la sala pública si tiene ticket pagado y activo
            if (state.dailyTicketId !== null) {
              const publicPosition = {
                vehicleId: state.vehicleId,
                plate: state.plate,
                routeId: state.routeId,
                direction: state.direction,
                lat: state.lastPosition.latitude || state.lastPosition.lat,
                lng: state.lastPosition.longitude || state.lastPosition.lng,
                speed: state.lastPosition.speed || 0,
                course: state.lastPosition.course || 0,
                lastUpdate: state.lastPosition.deviceTime || state.lastPosition.lastUpdate || new Date().toISOString(),
              };
              this.server.to(`public-tenant:${state.tenantId}`).emit('positions', [publicPosition]);
            }
            
            this.logger.log(`[Socket.io Cache Sync] Sincronización en caliente para vehículo ${vehicleId} emitida a salas de "tenant:${state.tenantId}"`);
          }
        } catch (error: any) {
          this.logger.error(`Error al procesar la actualización en caliente de caché en WebSocket: ${error.message}`);
        }
      },
      error: (err) => {
        this.logger.error(`Error en la suscripción de actualizaciones de caché: ${err.message}`);
      }
    });
  }
}
