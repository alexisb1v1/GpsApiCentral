import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { VehicleEntity } from '@vehicle/domain/entities/vehicle.entity';
import { DailyTicketEntity } from '@daily-ticket/domain/entities/daily-ticket.entity';
import { DailyRoundEntity } from '@daily-ticket/domain/entities/daily-round.entity';

export enum InfractionType {
  PIRATERIA = 'PIRATERIA',
  EVASION_PAGO = 'EVASION_PAGO',
  RETRASO_RUTA = 'RETRASO_RUTA',
}

export enum InfractionStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  ANNULLED = 'ANNULLED',
}

@Entity('infractions')
export class InfractionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'vehicle_id', type: 'uuid' })
  vehicleId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'daily_ticket_id', type: 'uuid' })
  dailyTicketId: string;

  @Column({ name: 'round_id', type: 'uuid', nullable: true })
  roundId: string | null;

  @Column({
    type: 'enum',
    enum: InfractionType,
  })
  type: InfractionType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: InfractionStatus,
    default: InfractionStatus.PENDING,
  })
  status: InfractionStatus;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => VehicleEntity)
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: VehicleEntity;

  @ManyToOne(() => DailyTicketEntity)
  @JoinColumn({ name: 'daily_ticket_id' })
  dailyTicket: DailyTicketEntity;

  @ManyToOne(() => DailyRoundEntity, { nullable: true })
  @JoinColumn({ name: 'round_id' })
  round: DailyRoundEntity | null;
}
