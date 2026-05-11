import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { DailyTicketEntity } from './daily-ticket.entity';

export enum RoundsStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('daily_rounds')
export class DailyRoundEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'daily_ticket_id', type: 'uuid' })
  dailyTicketId: string;

  @Column({ name: 'round_number', type: 'integer' })
  roundNumber: number;

  @Column({ name: 'start_time', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'timestamptz', nullable: true })
  endTime: Date;

  @Column({
    type: 'enum',
    enum: RoundsStatus,
    default: RoundsStatus.IN_PROGRESS,
  })
  status: RoundsStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => DailyTicketEntity)
  @JoinColumn({ name: 'daily_ticket_id' })
  dailyTicket: DailyTicketEntity;
}
