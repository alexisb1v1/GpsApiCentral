import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayInit } from '@nestjs/websockets';
import { OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Subscription } from 'rxjs';
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

      if (Array.isArray(token)) {
        token = token[0];
      }

      if (token && token.startsWith('Bearer ')) {
        token = token.slice(7);
      }

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
      await socket.join(`tenant:${tenantId}`);
      
      this.logger.log(`[Socket.io] Cliente ${socket.id} autenticado con éxito para Tenant: "${tenantId}". Unido a la sala.`);

      // 4. State Cache: Emitir instantáneamente las últimas posiciones conocidas del tenant (evento positions)
      const initialPositions = this.vehicleTenantCache.getLatestPositionsByTenant(tenantId);
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
   * Se suscribe al stream reactivo de Traccar y retransmite de forma enriquecida y aislada a cada sala
   */
  private subscribeToTraccarPositions() {
    this.traccarSubscription = this.traccarSocketService.positions$.subscribe({
      next: (positions) => {
        try {
          // Agrupamos las posiciones enriquecidas por tenantId para emitir de forma eficiente en ráfagas
          const positionsByTenant = new Map<string, any[]>();

          for (const pos of positions) {
            if (!pos.deviceId) continue;

            // 1. Actualizar el State Cache en memoria con la última posición del vehículo
            this.vehicleTenantCache.updateLastPosition(pos.deviceId, pos);

            const state = this.vehicleTenantCache.getVehicleState(pos.deviceId);
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
            
            // Log ligero de telemetría (opcional, útil para validaciones iniciales)
            this.logger.debug(`Emitidas ${tenantPositions.length} posiciones satelitales a sala "tenant:${tenantId}"`);
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
            this.logger.log(`[Socket.io Cache Sync] Sincronización en caliente para vehículo ${vehicleId} emitida a sala "tenant:${state.tenantId}"`);
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
