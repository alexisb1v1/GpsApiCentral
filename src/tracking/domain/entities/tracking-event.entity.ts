import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { DailyRoundEntity } from '@daily-ticket/domain/entities/daily-round.entity';
import { DailyTicketEntity } from '@daily-ticket/domain/entities/daily-ticket.entity';

export enum TrackingEventType {
  ENTER = 'geofenceEnter',
  EXIT = 'geofenceExit',
}

@Entity('tracking_events')
export class TrackingEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'daily_ticket_id', type: 'uuid' })
  dailyTicketId: string;

  @Column({ name: 'traccar_geofence_id', type: 'int', nullable: true })
  traccarGeofenceId: number | null;

  @Column({ name: 'round_id', type: 'uuid', nullable: true })
  roundId: string | null;

  @Column({
    type: 'enum',
    enum: TrackingEventType,
  })
  eventType: TrackingEventType;

  @Column({ name: 'server_time', type: 'timestamptz' })
  serverTime: Date;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude: number;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds: number | null;

  @Column({ name: 'raw_payload', type: 'jsonb', nullable: true })
  rawPayload: any | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => DailyTicketEntity)
  @JoinColumn({ name: 'daily_ticket_id' })
  dailyTicket: DailyTicketEntity;

  @ManyToOne(() => DailyRoundEntity)
  @JoinColumn({ name: 'round_id' })
  round: DailyRoundEntity;
}
