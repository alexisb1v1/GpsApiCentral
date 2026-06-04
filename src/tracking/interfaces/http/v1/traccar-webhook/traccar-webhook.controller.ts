import { Controller, Post, Body, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TraccarWebhookRequestDto } from './dto/traccar-webhook.request.dto';
import { ProcessTraccarWebhookCommand } from '@tracking/application/commands/v1/process-traccar-webhook/process-traccar-webhook.command';
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
    console.log('[Webhook Traccar] Raw Body recibido:', JSON.stringify(dto, null, 2));

    // Si Traccar envía codificado en URL-encoded con strings JSON (común en algunas versiones), decodificarlo
    let payload = dto;
    if (dto && typeof dto.event === 'string') {
      try {
        payload = {
          event: JSON.parse(dto.event),
          device: dto.device ? JSON.parse(dto.device) : undefined,
          position: dto.position ? JSON.parse(dto.position) : undefined,
        };
        console.log('[Webhook Traccar] 🛠 Payload decodificado desde strings JSON:', JSON.stringify(payload, null, 2));
      } catch (e: any) {
        console.error('[Webhook Traccar] ❌ Error al parsear strings JSON del webhook:', e.message);
      }
    }

    const eventType = payload.event?.type;
    const deviceId = payload.event?.deviceId;
    const uniqueId = payload.device?.uniqueId;
    const geofenceId = payload.event?.geofenceId;

    console.log(
      `[Webhook Traccar] 📥 Evento procesado -> Tipo: ${eventType}, Dispositivo: ${deviceId} (IMEI: ${uniqueId}), Geocerca: ${geofenceId}`
    );

    // Procesar únicamente si es entrada o salida de geocerca
    if (eventType === 'geofenceEnter' || eventType === 'geofenceExit') {
      // Procesamiento asíncrono vía CQRS
      await this.commandBus.execute(
        new ProcessTraccarWebhookCommand(payload),
      );
    } else {
      console.log(`[Webhook Traccar] ℹ️ Evento '${eventType}' ignorado (no es entrada/salida de geocerca).`);
    }
    
    return { success: true };
  }
}
