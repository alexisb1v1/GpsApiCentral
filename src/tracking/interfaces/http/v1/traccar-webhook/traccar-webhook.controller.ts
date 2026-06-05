import { Controller, Post, Body, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TraccarWebhookRequestDto } from './dto/traccar-webhook.request.dto';
import { ProcessTraccarWebhookCommand } from '@tracking/application/commands/v1/process-traccar-webhook/process-traccar-webhook.command';
import { ConciliateOfflineEventsCommand } from '@tracking/application/commands/v1/conciliate-offline-events/conciliate-offline-events.command';
import { Public } from '@shared/infrastructure/decorators/public.decorator';

@ApiTags('Tracking Webhooks')
@Controller('v1/webhook/traccar')
export class TraccarWebhookController {
  private readonly logger = new Logger(TraccarWebhookController.name);

  constructor(private readonly commandBus: CommandBus) {}

  @Post('receive')
  @Public()
  @ApiOperation({ summary: 'Recibir eventos de geocercas desde Traccar' })
  async handle(@Body() dto: any) {
    // Imprimir el payload bruto recibido
    console.log('[Webhook Traccar] Raw Body recibido:', JSON.stringify(dto));

    // Si Traccar envía codificado en URL-encoded con strings JSON (común en algunas versiones), decodificarlo
    let payload = dto;
    if (dto && typeof dto.event === 'string') {
      try {
        payload = {
          event: JSON.parse(dto.event),
          device: dto.device ? JSON.parse(dto.device) : undefined,
          position: dto.position ? JSON.parse(dto.position) : undefined,
        };
        console.log('[Webhook Traccar] 🛠 Payload decodificado desde strings JSON:', JSON.stringify(payload));
      } catch (e: any) {
        console.error('[Webhook Traccar] ❌ Error al parsear strings JSON del webhook:', e.message);
      }
    }

    const eventType = payload.event?.type;
    const deviceId = payload.event?.deviceId;
    const uniqueId = payload.device?.uniqueId;
    const geofenceId = payload.event?.geofenceId;

    console.log(
      `[Webhook Traccar] 📥 Evento recibido -> Tipo: ${eventType}, Dispositivo: ${deviceId} (IMEI: ${uniqueId}), Geocerca: ${geofenceId}`
    );

    // Procesar según tipo de evento
    if (eventType === 'geofenceEnter' || eventType === 'geofenceExit') {
      // Procesamiento asíncrono vía CQRS para geocercas
      await this.commandBus.execute(
        new ProcessTraccarWebhookCommand(payload),
      );
    } else if (eventType === 'deviceOnline') {
      // Reconexión satelital de red, gatillar conciliación
      if (deviceId) {
        this.logger.log(`[Webhook Traccar] Dispositivo ID ${deviceId} en línea (deviceOnline). Iniciando conciliación de eventos...`);
        // Se ejecuta en segundo plano o asíncronamente
        this.commandBus.execute(
          new ConciliateOfflineEventsCommand(deviceId)
        ).catch(err => {
          this.logger.error(`[Webhook Traccar] Error al ejecutar ConciliateOfflineEventsCommand para dispositivo ${deviceId}: ${err.message}`);
        });
      }
    } else {
      console.log(`[Webhook Traccar] ℹ️ Evento '${eventType}' ignorado.`);
    }
    
    return { success: true };
  }
}
