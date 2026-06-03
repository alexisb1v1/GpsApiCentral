import { Controller, Post, Body, Req, BadRequestException } from '@nestjs/common';
import { CommandBus, EventBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { CreateInfractionRequestDto } from '@infraction/application/commands/v1/create-infraction/dto/create-infraction.request.dto';
import { CreateInfractionCommand } from '@infraction/application/commands/v1/create-infraction/create-infraction.command';
import { matchResult } from '@common/http/match-result';
import { Audit, AuditContext } from '@shared/infrastructure/decorators/audit-context.decorator';
import { DriverNotificationSentEvent } from '@monitoring/domain/events/driver-notification-sent.event';
import { IsUUID, IsEnum, IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DailyTicketEntity } from '@daily-ticket/domain/entities/daily-ticket.entity';
import { DailyRoundEntity } from '@daily-ticket/domain/entities/daily-round.entity';
import { InfractionEntity, InfractionStatus, InfractionType } from '@infraction/domain/entities/infraction.entity';
import { Public } from '@shared/infrastructure/decorators/public.decorator';
import { getLocalDateString } from '@shared/utils/date.util';


export class SimulateInfractionRequestDto {
  @ApiProperty({ example: 'driver-user-uuid', description: 'ID del usuario/chofer a notificar' })
  @IsUUID()
  driverId: string;

  @ApiProperty({
    example: 'INFRACTION',
    description: 'Tipo de alerta a simular en el frontend',
    enum: ['INFRACTION', 'CHECKPOINT_MARKED', 'NEXT_CHECKPOINT', 'SYSTEM'],
  })
  @IsEnum(['INFRACTION', 'CHECKPOINT_MARKED', 'NEXT_CHECKPOINT', 'SYSTEM'])
  type: 'INFRACTION' | 'CHECKPOINT_MARKED' | 'NEXT_CHECKPOINT' | 'SYSTEM';

  @ApiProperty({ example: 'Sanción por Piratería', description: 'Título de la alerta' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Se ha detectado un desvío no autorizado de la ruta asignada.', description: 'Mensaje de la alerta' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({ example: 25.50, description: 'Monto de la multa (en Soles)', required: false })
  @IsNumber()
  @IsOptional()
  amount?: number;
}

@ApiTags('Infractions')
@ApiBearerAuth()
@Controller('v1/infractions')
export class CreateInfractionController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly eventBus: EventBus,
    @InjectRepository(DailyTicketEntity)
    private readonly ticketTypeOrmRepository: Repository<DailyTicketEntity>,
    @InjectRepository(InfractionEntity)
    private readonly infractionTypeOrmRepository: Repository<InfractionEntity>,
    @InjectRepository(DailyRoundEntity)
    private readonly roundTypeOrmRepository: Repository<DailyRoundEntity>,
  ) {}

  @Post('create')
  @ApiOperation({ summary: 'Registrar una nueva infracción' })
  async execute(
    @Body() dto: CreateInfractionRequestDto,
    @Req() req: any,
    @Audit() audit: AuditContext,
  ) {
    const result = await this.commandBus.execute(
      new CreateInfractionCommand(
        req.user.tenantId,
        dto.vehicleId,
        req.user.sub,
        dto.type,
        dto.amount,
        dto.description || null,
        audit.ip,
        audit.userAgent,
      ),
    );

    return matchResult(result);
  }

  @Public()
  @Post('simulate')
  @ApiOperation({ summary: 'Simular y guardar notificación en tiempo real a la app del chofer (Pruebas Internas)' })
  async simulateNotification(@Body() dto: SimulateInfractionRequestDto) {
    // 1. Obtener la fecha de hoy en la zona horaria local 'America/Lima'
    const today = getLocalDateString();

    // 2. Buscar si el conductor tiene un ticket diario de viaje activo registrado hoy
    const ticket = await this.ticketTypeOrmRepository.findOne({
      where: {
        driverId: dto.driverId,
        workDate: today as any,
        status: 'ACTIVE' as any,
      },
    });

    if (!ticket) {
      throw new BadRequestException(
        `Para simular una sanción real de BD, el chofer con user ID "${dto.driverId}" debe tener un despacho/ticket de salida activo registrado hoy en el sistema. Registra un ticket para él primero.`,
      );
    }

    // Buscar vuelta activa (IN_PROGRESS)
    const activeRound = await this.roundTypeOrmRepository.findOne({
      where: {
        dailyTicketId: ticket.id,
        status: 'IN_PROGRESS' as any,
      },
      order: { roundNumber: 'DESC' },
    });

    let roundId: string | null = null;
    if (activeRound) {
      roundId = activeRound.id;
    } else {
      // Si no hay vuelta activa (IN_PROGRESS), obtener la última vuelta creada
      const lastRound = await this.roundTypeOrmRepository.findOne({
        where: { dailyTicketId: ticket.id },
        order: { roundNumber: 'DESC' },
      });
      if (lastRound) {
        roundId = lastRound.id;
      }
    }

    // 3. Crear y guardar la infracción real en la base de datos
    const infraction = new InfractionEntity();
    infraction.tenantId = ticket.tenantId;
    infraction.vehicleId = ticket.vehicleId;
    infraction.userId = dto.driverId;
    infraction.dailyTicketId = ticket.id;
    infraction.roundId = roundId;
    infraction.type = InfractionType.RETRASO_RUTA;
    infraction.amount = dto.amount || 20.00;
    infraction.description = dto.message;
    infraction.status = InfractionStatus.PENDING;

    const savedInfraction = await this.infractionTypeOrmRepository.save(infraction);

    // 4. Publicar la alerta de WebSocket a través del EventBus
    const event = new DriverNotificationSentEvent(
      dto.driverId,
      {
        id: savedInfraction.id,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        timestamp: new Date(),
        data: {
          infractionId: savedInfraction.id,
          amount: savedInfraction.amount,
        },
      },
    );
    await this.eventBus.publish(event);

    return {
      success: true,
      message: `Infracción simulada registrada con éxito en BD (ID: ${savedInfraction.id}) y notificada al chofer ${dto.driverId}`,
      data: savedInfraction,
    };
  }
}
