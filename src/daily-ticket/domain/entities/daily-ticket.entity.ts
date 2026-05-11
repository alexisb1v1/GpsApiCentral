import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique, Index, OneToMany } from 'typeorm';
import { VehicleEntity } from '@vehicle/domain/entities/vehicle.entity';
import { UserEntity } from '@user/domain/entities/user.entity';
import { TenantEntity } from '@tenant/domain/entities/tenant.entity';
import { DailyRoundEntity } from './daily-round.entity';

export enum TicketStatus {
  ACTIVE = 'ACTIVE',
  VOIDED = 'VOIDED',
}

@Entity('daily_tickets')
@Unique(['vehicleId', 'workDate'])
@Index('idx_daily_tickets_tenant', ['tenantId'])
export class DailyTicketEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vehicle_id', type: 'uuid' })
  vehicleId: string;

  @Column({ name: 'registered_by', type: 'uuid' })
  registeredBy: string;

  @Column({ name: 'route_id', type: 'uuid', nullable: true })
  routeId: string | null;

  @Column({ name: 'work_date', type: 'date', default: () => 'CURRENT_DATE' })
  workDate: Date;

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ name: 'admin_fee', type: 'decimal', precision: 10, scale: 2 })
  adminFee: number;

  @Column({ name: 'route_fee', type: 'decimal', precision: 10, scale: 2 })
  routeFee: number;

  @Column({
    type: 'enum',
    enum: TicketStatus,
    default: TicketStatus.ACTIVE,
  })
  status: TicketStatus;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => VehicleEntity)
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: VehicleEntity;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'registered_by' })
  user: UserEntity;

  @ManyToOne(() => TenantEntity)
  @JoinColumn({ name: 'tenant_id' })
  tenant: TenantEntity;

  @OneToMany(() => DailyRoundEntity, (round) => round.dailyTicket)
  rounds: DailyRoundEntity[];
}
