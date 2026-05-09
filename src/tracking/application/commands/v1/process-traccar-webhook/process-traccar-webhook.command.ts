import { TraccarWebhookRequestDto } from '../../../../interfaces/http/v1/traccar-webhook/dto/traccar-webhook.request.dto';

export class ProcessTraccarWebhookCommand {
  constructor(public readonly payload: TraccarWebhookRequestDto) {}
}
