import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateInfractionCommand } from '../create-infraction.command';
import { InfractionRepository } from '@infraction/domain/repositories/infraction.repository';
import { InfractionEntity, InfractionStatus } from '@infraction/domain/entities/infraction.entity';
import { VehicleRepository } from '@vehicle/domain/repositories/vehicle.repository';
import { DailyTicketEntity } from '@daily-ticket/domain/entities/daily-ticket.entity';
import { DailyRoundEntity } from '@daily-ticket/domain/entities/daily-round.entity';
import { AppError } from '@shared/domain/errors/app-errors';
import { AuditService } from '@shared/application/services/audit.service';
import { getLocalDateString } from '@shared/utils/date.util';


@CommandHandler(CreateInfractionCommand)
export class CreateInfractionHandler implements ICommandHandler<CreateInfractionCommand> {
  constructor(
    @Inject('InfractionRepository')
    private readonly infractionRepository: InfractionRepository,
    @Inject('VehicleRepository')
    private readonly vehicleRepository: VehicleRepository,
    @InjectRepository(DailyTicketEntity)
    private readonly ticketRepository: Repository<DailyTicketEntity>,
    @InjectRepository(DailyRoundEntity)
    private readonly roundRepository: Repository<DailyRoundEntity>,
    private readonly auditService: AuditService,
  ) {}

  async execute(command: CreateInfractionCommand): Promise<Result<InfractionEntity, AppError>> {
    // 1. Validar que el vehículo existe y pertenece al tenant
    const vehicleResult = await this.vehicleRepository.findById(command.vehicleId);
    if (vehicleResult.isErr()) return err(vehicleResult.error);
    
    const vehicle = vehicleResult.value;
    if (vehicle.tenantId !== command.tenantId) {
      return err('FORBIDDEN' as any); // O un error más específico de dominio
    }

    // 2. Buscar ticket diario activo de hoy para este vehículo y su respectiva vuelta (Round)
    const todayStr = getLocalDateString(); // Formato YYYY-MM-DD

    const ticket = await this.ticketRepository.findOne({
      where: {
        vehicleId: command.vehicleId,
        workDate: todayStr as any,
        status: 'ACTIVE' as any,
      },
    });

    let dailyTicketId: string | null = null;
    let roundId: string | null = null;

    if (ticket) {
      dailyTicketId = ticket.id;

      // Buscar vuelta activa (IN_PROGRESS)
      const activeRound = await this.roundRepository.findOne({
        where: {
          dailyTicketId: ticket.id,
          status: 'IN_PROGRESS' as any,
        },
        order: { roundNumber: 'DESC' },
      });

      if (activeRound) {
        roundId = activeRound.id;
      } else {
        // Si no hay vuelta activa (IN_PROGRESS), obtener la última vuelta creada
        const lastRound = await this.roundRepository.findOne({
          where: { dailyTicketId: ticket.id },
          order: { roundNumber: 'DESC' },
        });
        if (lastRound) {
          roundId = lastRound.id;
        }
      }
    }

    // 3. Crear la entidad
    const infraction = new InfractionEntity();
    infraction.tenantId = command.tenantId;
    infraction.vehicleId = command.vehicleId;
    infraction.userId = command.userId;
    if (dailyTicketId) {
      infraction.dailyTicketId = dailyTicketId;
    }
    infraction.roundId = roundId;
    infraction.type = command.type;
    infraction.amount = command.amount;
    infraction.status = InfractionStatus.PENDING;
    infraction.description = command.description;

    // 3. Guardar
    const saveResult = await this.infractionRepository.save(infraction);
    if (saveResult.isErr()) return err(saveResult.error);

    const savedInfraction = saveResult.value;

    // 4. Registrar en auditoría
    this.auditService.createLog({
      tenantId: command.tenantId,
      userId: command.userId,
      action: 'CREATE_INFRACTION',
      entityName: 'infractions',
      entityId: savedInfraction.id,
      newValues: savedInfraction,
      ipAddress: command.ipAddress,
      userAgent: command.userAgent,
    });

    return ok(savedInfraction);
  }
}
