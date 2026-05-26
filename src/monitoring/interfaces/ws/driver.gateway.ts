import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayInit } from '@nestjs/websockets';
import { Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Subscription } from 'rxjs';
import { VehicleTenantCache } from '../../infrastructure/cache/vehicle-tenant.cache';

@WebSocketGateway({
  namespace: '/driver',
  cors: {
    origin: '*',
  },
})
export class DriverGateway implements OnGatewayConnection, OnGatewayInit, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DriverGateway.name);
  private cacheSubscription: Subscription | null = null;

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly vehicleTenantCache: VehicleTenantCache,
  ) {}

  afterInit(server: Server) {
    this.logger.log('Gateway de Conductor (/driver) inicializado con éxito.');
  }

  onModuleInit() {
    this.subscribeToCacheUpdates();
  }

  onModuleDestroy() {
    if (this.cacheSubscription) {
      this.cacheSubscription.unsubscribe();
    }
  }

  async handleConnection(socket: Socket) {
    try {
      this.logger.log(`[Driver WS] Intento de conexión en namespace /driver desde cliente ${socket.id}`);

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
        this.logger.warn(`[Driver WS] Conexión rechazada en /driver para ${socket.id}: No se envió ningún token JWT.`);
        socket.disconnect();
        return;
      }

      // 2. Validar JWT de forma asíncrona
      const payload = await this.jwtService.verifyAsync(token);
      if (!payload || !payload.sub || !payload.tenantId) {
        this.logger.warn(`[Driver WS] Conexión rechazada en /driver para ${socket.id}: Token JWT inválido o malformado.`);
        socket.disconnect();
        return;
      }

      const driverId = payload.sub; // sub almacena el id del usuario/chofer en el payload generado por LoginHandler
      const tenantId = payload.tenantId;

      socket['driverId'] = driverId;
      socket['tenantId'] = tenantId;

      // 3. Vincular el socket a la sala única del conductor
      await socket.join(`driver:${driverId}`);
      this.logger.log(`[Driver WS] Chofer ${driverId} (Tenant: "${tenantId}") autenticado de forma exitosa. Unido a la sala.`);

      // 4. State Cache Latencia Cero: Emitir instantáneamente la última posición conocida de su vehículo asignado
      const initialPosition = this.vehicleTenantCache.getLatestPositionByDriver(driverId);
      if (initialPosition) {
        socket.emit('positions', [initialPosition]);
        this.logger.log(`[Driver WS] Latencia Cero: Enviada posición inicial en caliente del vehículo del chofer ${driverId}`);
      } else {
        this.logger.log(`[Driver WS] El chofer ${driverId} no cuenta con un vehículo/posición en caliente activa.`);
      }

    } catch (error: any) {
      this.logger.error(`[Driver WS] Excepción al establecer conexión en /driver para cliente ${socket.id}: ${error.message}`);
      socket.disconnect();
    }
  }

  /**
   * Método público llamado desde el stream de posiciones para retransmitir en tiempo real
   */
  emitPositionToDriver(driverId: string, position: any) {
    try {
      if (this.server) {
        this.server.to(`driver:${driverId}`).emit('positions', [position]);
        this.logger.debug(`[Driver WS] Posición en tiempo real retransmitida al chofer ${driverId}`);
      }
    } catch (error: any) {
      this.logger.error(`[Driver WS] Error al retransmitir posición al chofer ${driverId}: ${error.message}`);
    }
  }

  /**
   * Se suscribe a los cambios de caché para retransmitir asignaciones de vehículos en caliente al chofer
   */
  private subscribeToCacheUpdates() {
    this.cacheSubscription = this.vehicleTenantCache.cacheUpdates$.subscribe({
      next: ({ vehicleId, state }) => {
        try {
          // Si el vehículo tiene un conductor y tiene posición de GPS, notificar de inmediato
          if (state.driverId && state.lastPosition) {
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
            this.emitPositionToDriver(state.driverId, enrichedPosition);
            this.logger.log(`[Driver WS Cache Sync] Notificada asignación en caliente de vehículo ${vehicleId} al chofer ${state.driverId}`);
          }
        } catch (error: any) {
          this.logger.error(`Error al procesar actualización de caché en DriverGateway: ${error.message}`);
        }
      },
      error: (err) => {
        this.logger.error(`Error en stream de caché de DriverGateway: ${err.message}`);
      }
    });
  }
}
