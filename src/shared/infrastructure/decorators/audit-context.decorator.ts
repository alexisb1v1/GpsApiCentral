import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuditContext {
  ip: string;
  userAgent: string;
}

/**
 * Decorador personalizado para extraer información de auditoría (IP y User-Agent)
 * de forma automática y limpia en los controladores.
 * 
 * Al usar este decorador, Swagger NO lo mostrará como un campo obligatorio,
 * ya que la información se extrae internamente de la petición.
 */
export const Audit = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuditContext => {
    const request = ctx.switchToHttp().getRequest();
    
    // Obtenemos la IP real (gracias a 'trust proxy' en main.ts)
    const ip = request.ip || request.connection.remoteAddress;
    
    // Obtenemos el User-Agent
    const userAgent = request.headers['user-agent'] || 'unknown';

    return {
      ip,
      userAgent,
    };
  },
);
