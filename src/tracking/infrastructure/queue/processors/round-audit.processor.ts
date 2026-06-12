import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommandBus } from '@nestjs/cqrs';
import { DailyRoundEntity } from '../../../../daily-ticket/domain/entities/daily-round.entity';
import { ITraccarProvider } from '../../../../shared/infrastructure/traccar/traccar-provider.interface';
import { AuditRoundCommand } from '../../../application/commands/v1/audit-round/audit-round.command';

@Processor('audit-round-queue')
export class RoundAuditProcessor extends WorkerHost {
  private readonly logger = new Logger(RoundAuditProcessor.name);

  constructor(
    @InjectRepository(DailyRoundEntity)
    private readonly roundRepository: Repository<DailyRoundEntity>,
    @Inject('ITraccarProvider')
    private readonly traccarProvider: ITraccarProvider,
    private readonly commandBus: CommandBus,
  ) {
    super();
  }

  async process(job: Job<{ roundId: string }>): Promise<void> {
    const { roundId } = job.data;
    const attemptsMade = job.attemptsMade; // 0 en el primer intento, 1 en el segundo, etc.
    this.logger.log(`Procesando auditoría para Vuelta ID: ${roundId}. Intento: ${attemptsMade + 1}`);

    // 1. Obtener la vuelta con su ticket y vehículo
    const round = await this.roundRepository.findOne({
      where: { id: roundId },
      relations: ['dailyTicket', 'dailyTicket.vehicle'],
    });

    if (!round) {
      this.logger.warn(`Vuelta con ID ${roundId} no encontrada en la base de datos. Omitiendo.`);
      return;
    }

    const ticket = round.dailyTicket;
    if (!ticket) {
      this.logger.warn(`Ticket asociado a la vuelta ${roundId} no encontrado. Omitiendo.`);
      return;
    }

    const vehicle = ticket.vehicle;
    if (!vehicle || !vehicle.traccarId) {
      this.logger.warn(`Vehículo o traccarId no encontrado para la vuelta ${roundId}. Ejecutando en modo incompleto.`);
      await this.commandBus.execute(new AuditRoundCommand(roundId, true));
      return;
    }

    // 2. Determinar rango de posiciones a evaluar en Traccar
    // Evaluamos desde el inicio de la vuelta (o 10 mins antes por seguridad) hasta la hora actual del servidor.
    const fromTime = new Date((round.startTime || round.createdAt).getTime() - 10 * 60 * 1000);
    const toTime = new Date();

    this.logger.log(`Consultando posiciones en Traccar para dispositivo ID ${vehicle.traccarId} desde ${fromTime.toISOString()} hasta ${toTime.toISOString()}`);
    const positionsResult = await this.traccarProvider.getDevicePositions(vehicle.traccarId, fromTime, toTime);

    if (positionsResult.isErr()) {
      const errorMsg = `Error al consultar posiciones en Traccar para dispositivo ${vehicle.traccarId}: ${positionsResult.error.message}`;
      this.logger.error(errorMsg);

      if (attemptsMade < 4) {
        throw new Error(errorMsg); // Forzar reintento con backoff
      } else {
        this.logger.warn(`Máximos intentos alcanzados tras fallos de comunicación con Traccar. Oficializando modo incompleto.`);
        await this.commandBus.execute(new AuditRoundCommand(roundId, true));
        return;
      }
    }

    const positions = positionsResult.value;

    if (positions.length === 0) {
      const msg = `No se encontraron posiciones registradas en Traccar para la vuelta ${roundId}`;
      this.logger.warn(msg);

      if (attemptsMade < 4) {
        throw new Error(msg); // Forzar reintento con backoff
      } else {
        this.logger.warn(`Máximos intentos alcanzados sin reportes en Traccar. Oficializando modo incompleto.`);
        await this.commandBus.execute(new AuditRoundCommand(roundId, true));
        return;
      }
    }

    // Ordenar posiciones por hora (cronológicamente de más antiguo a más nuevo)
    positions.sort((a, b) => new Date(a.deviceTime || a.fixTime).getTime() - new Date(b.deviceTime || b.fixTime).getTime());
    const lastPosition = positions[positions.length - 1];

    const fixTime = new Date(lastPosition.fixTime || lastPosition.deviceTime);
    const serverTime = new Date();
    const deltaSeconds = (serverTime.getTime() - fixTime.getTime()) / 1000;

    this.logger.log(`Última posición del dispositivo ${vehicle.traccarId} en Traccar: ${fixTime.toISOString()}. Server time: ${serverTime.toISOString()}. Delta: ${deltaSeconds}s`);

    // 3. Evaluar el delta (45s latencia de buffer)
    if (deltaSeconds > 45) {
      const warnMsg = `Latencia en buffer de Traccar detectada (Delta de ${deltaSeconds}s > 45s). El dispositivo no está al día.`;
      this.logger.warn(warnMsg);

      if (attemptsMade < 4) {
        throw new Error(warnMsg); // Forzar reintento con backoff exponencial
      } else {
        this.logger.warn(`Máximos intentos alcanzados (5) con retraso de reporte. Se asume que el GPS se apagó o perdió cobertura. Ejecutando en modo incompleto.`);
        await this.commandBus.execute(new AuditRoundCommand(roundId, true));
      }
    } else {
      this.logger.log(`Datos satelitales al día (Delta de ${deltaSeconds}s <= 45s). Ejecutando auditoría en modo completo.`);
      await this.commandBus.execute(new AuditRoundCommand(roundId, false));
    }
  }
}
