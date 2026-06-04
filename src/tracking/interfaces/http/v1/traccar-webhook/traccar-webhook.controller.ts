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
  async handle(@Body() dto: TraccarWebhookRequestDto) {
    const eventType = dto.event?.type;
    const deviceId = dto.event?.deviceId;
    const uniqueId = dto.device?.uniqueId;
    const geofenceId = dto.event?.geofenceId;

    console.log(
      `[Webhook Traccar] 📥 Evento recibido -> Tipo: ${eventType}, Dispositivo: ${deviceId} (IMEI: ${uniqueId}), Geocerca: ${geofenceId}`
    );

    // Procesar únicamente si es entrada o salida de geocerca
    if (eventType === 'geofenceEnter' || eventType === 'geofenceExit') {
      // Procesamiento asíncrono vía CQRS
      await this.commandBus.execute(
        new ProcessTraccarWebhookCommand(dto),
      );
    } else {
      console.log(`[Webhook Traccar] ℹ️ Evento '${eventType}' ignorado (no es entrada/salida de geocerca).`);
    }
    
    return { success: true };
  }
}
