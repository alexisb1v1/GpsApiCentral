import { Controller, Post, Body, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TraccarWebhookRequestDto } from './dto/traccar-webhook.request.dto';
import { ProcessTraccarWebhookCommand } from '@tracking/application/commands/v1/process-traccar-webhook/process-traccar-webhook.command';

@ApiTags('Tracking Webhooks')
@Controller('v1/webhook/traccar')
export class TraccarWebhookController {
  private readonly logger = new Logger(TraccarWebhookController.name);

  constructor(private readonly commandBus: CommandBus) {}

  @Post('receive')
  @ApiOperation({ summary: 'Recibir eventos de geocercas desde Traccar' })
  async handle(@Body() dto: TraccarWebhookRequestDto) {
    this.logger.log(
      `📥 Webhook de Traccar recibido. Dispositivo ID: ${dto.event?.deviceId} (IMEI: ${dto.device?.uniqueId}), Evento: ${dto.event?.type}, Geocerca ID: ${dto.event?.geofenceId}`
    );

    // Procesamiento asíncrono vía CQRS
    await this.commandBus.execute(
      new ProcessTraccarWebhookCommand(dto),
    );
    
    return { success: true };
  }
}
