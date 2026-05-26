import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Subject } from 'rxjs';
import * as WebSocket from 'ws';
import { VehicleTenantCache } from '../cache/vehicle-tenant.cache';

@Injectable()
export class TraccarSocketService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TraccarSocketService.name);
  private ws: WebSocket | null = null;
  
  // Parámetros de conexión y credenciales configuradas
  private traccarUrl: string;
  private wsUrl: string;
  private traccarEmail: string;
  private traccarPassword: string;

  private isDestroyed = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnecting = false;

  // Stream reactivo público para emitir las posiciones satelitales a la aplicación
  public readonly positions$ = new Subject<any[]>();

  constructor(
    private readonly configService: ConfigService,
    private readonly vehicleTenantCache: VehicleTenantCache,
  ) {
    // Carga de variables de entorno con defaults seguros
    this.traccarUrl = this.configService.get<string>('TRACCAR_URL') || 'http://localhost:8082';
    this.wsUrl = this.configService.get<string>('TRACCAR_WS_URL') || 'ws://localhost:8082/api/socket';
    this.traccarEmail = this.configService.get<string>('TRACCAR_EMAIL') || 'admin@admin.com';
    this.traccarPassword = this.configService.get<string>('TRACCAR_PASSWORD') || 'admin';
  }

  async onModuleInit() {
    this.logger.log('[Traccar WS] Esperando hidratación máster de caché en memoria antes de abrir el WebSocket...');
    try {
      await this.vehicleTenantCache.preloadCache();
      this.logger.log('[Traccar WS] Caché en memoria hidratado con éxito. Conectando al WebSocket de Traccar...');
    } catch (cacheError: any) {
      this.logger.error(`[Traccar WS] Advertencia al precargar el caché: ${cacheError.message}. Se intentará conectar de todas formas.`);
    }
    this.connectToTraccar();
  }

  onModuleDestroy() {
    this.isDestroyed = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    this.closeConnection();
  }

  /**
   * Inicializa y establece la conexión WebSocket con Traccar,
   * realizando primero un inicio de sesión HTTP para obtener la cookie JSESSIONID fresca.
   */
  private async connectToTraccar() {
    if (this.isDestroyed || this.isConnecting) return;
    this.isConnecting = true;

    this.logger.log('[Traccar WS] Iniciando proceso de conexión autónoma con autenticación...');

    try {
      // 1. NestJS realiza Login de forma autónoma con credenciales maestras usando fetch nativo de Node v22
      const loginUrl = `${this.traccarUrl.replace(/\/$/, '')}/api/session`;
      
      const loginParams = new URLSearchParams();
      loginParams.append('email', this.traccarEmail);
      loginParams.append('password', this.traccarPassword);

      const loginResponse = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: loginParams,
      });

      if (!loginResponse.ok) {
        throw new Error(`Fallo de autenticación HTTP. Estatus: ${loginResponse.status} ${loginResponse.statusText}`);
      }

      // 2. Extraer la cookie fresca de sesión (JSESSIONID) de forma robusta
      const setCookies = loginResponse.headers.getSetCookie();
      let sessionCookie = '';
      if (setCookies && setCookies.length > 0) {
        const jsessionidCookie = setCookies.find(c => c.includes('JSESSIONID'));
        if (jsessionidCookie) {
          sessionCookie = jsessionidCookie.split(';')[0];
        }
      }

      // Fallback a get('set-cookie') clásico si getSetCookie no devolvió nada
      if (!sessionCookie) {
        const rawSetCookie = loginResponse.headers.get('set-cookie');
        if (rawSetCookie) {
          const match = /JSESSIONID=([^;]+)/.exec(rawSetCookie);
          if (match) {
            sessionCookie = `JSESSIONID=${match[1]}`;
          }
        }
      }

      if (!sessionCookie) {
        this.logger.warn('[Traccar WS] No se detectó la cookie JSESSIONID en la cabecera set-cookie. Se intentará conectar sin cookies.');
      } else {
        this.logger.log('[Traccar WS] Autenticación HTTP exitosa. Cookie de sesión obtenida de forma correcta.');
      }

      // 3. Establecer la conexión del WebSocket pasando la cookie fresca
      const wsHeaders: Record<string, string> = {};
      if (sessionCookie) {
        wsHeaders['Cookie'] = sessionCookie;
      }

      this.ws = new WebSocket(this.wsUrl, {
        headers: wsHeaders,
      });

      this.ws.on('open', () => {
        this.logger.log('✅ [Traccar WS] Conectado exitosamente. Escuchando telemetría en tiempo real...');
        this.isConnecting = false;
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleSocketMessage(data);
      });

      this.ws.on('error', (error) => {
        this.logger.error(`❌ [Traccar WS] Error en el socket: ${error.message}`);
      });

      this.ws.on('close', (code, reason) => {
        this.logger.warn(`🔌 [Traccar WS] Conexión cerrada o expirada. Código: ${code}, Razón: ${reason.toString() || 'Desconocida'}`);
        this.isConnecting = false;
        this.scheduleReconnect(5000); // Reintentar en 5 segundos
      });

    } catch (error: any) {
      this.logger.error(`❌ [Traccar WS] Fallo al iniciar sesión o conectar con Traccar: ${error.message}`);
      this.isConnecting = false;
      this.scheduleReconnect(10000); // Reintentar en 10 segundos tras fallar el login (ej. si Traccar está apagado)
    }
  }

  /**
   * Procesa los mensajes recibidos del socket y publica en el Subject reactivo
   */
  private handleSocketMessage(data: WebSocket.Data) {
    try {
      const payload = JSON.parse(data.toString());

      // Traccar puede enviar posiciones, dispositivos, eventos, etc. en el payload del socket
      if (payload.positions && Array.isArray(payload.positions) && payload.positions.length > 0) {
        this.positions$.next(payload.positions);
      }
    } catch (error: any) {
      this.logger.error(`[Traccar WS] Error al parsear mensaje JSON: ${error.message}`);
    }
  }

  /**
   * Programa la reconexión tras un lapso de tiempo especificado
   */
  private scheduleReconnect(delayMs: number) {
    if (this.isDestroyed) return;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.logger.log(`[Traccar WS] Programando reconexión autónoma en ${delayMs / 1000} segundos...`);
    this.reconnectTimeout = setTimeout(() => {
      this.connectToTraccar();
    }, delayMs);
  }

  /**
   * Cierra de forma limpia la conexión del socket
   */
  private closeConnection() {
    if (this.ws) {
      this.logger.log('[Traccar WS] Cerrando conexión de WebSocket...');
      this.ws.terminate();
      this.ws = null;
    }
  }
}
