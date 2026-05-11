import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { VehicleEntity } from '@vehicle/domain/entities/vehicle.entity';
import { GeofenceEntity } from '@geofence/domain/entities/geofence.entity';
import { DailyRoundEntity } from '@daily-ticket/domain/entities/daily-round.entity';

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

  @Column({ name: 'vehicle_id', type: 'uuid' })
  vehicleId: string;

  @Column({ name: 'geofence_id', type: 'uuid', nullable: true })
  geofenceId: string;

  @Column({ name: 'round_id', type: 'uuid', nullable: true })
  roundId: string;

  @Column({
    type: 'enum',
    enum: TrackingEventType,
  })
  eventType: TrackingEventType;

  @Column({ name: 'fix_time', type: 'timestamptz' })
  fixTime: Date;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => VehicleEntity)
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: VehicleEntity;

  @ManyToOne(() => GeofenceEntity)
  @JoinColumn({ name: 'geofence_id' })
  geofence: GeofenceEntity;

  @ManyToOne(() => DailyRoundEntity)
  @JoinColumn({ name: 'round_id' })
  round: DailyRoundEntity;
}
