import { Controller, Post, Body } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TraccarWebhookRequestDto } from './dto/traccar-webhook.request.dto';
import { ProcessTraccarWebhookCommand } from '@tracking/application/commands/v1/process-traccar-webhook/process-traccar-webhook.command';

@ApiTags('Tracking Webhooks')
@Controller('v1/webhook/traccar')
export class TraccarWebhookController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('receive')
  @ApiOperation({ summary: 'Recibir eventos de geocercas desde Traccar' })
  async handle(@Body() dto: TraccarWebhookRequestDto) {
    // Procesamiento asíncrono vía CQRS
    await this.commandBus.execute(
      new ProcessTraccarWebhookCommand(dto),
    );
    
    return { success: true };
  }
}
