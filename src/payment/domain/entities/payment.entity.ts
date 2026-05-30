import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { TenantEntity } from '@tenant/domain/entities/tenant.entity';
import { DailyTicketEntity } from '@daily-ticket/domain/entities/daily-ticket.entity';
import { UserEntity } from '@user/domain/entities/user.entity';

@Entity('payments')
export class PaymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'daily_ticket_id', type: 'uuid', nullable: true })
  dailyTicketId: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ name: 'payment_method', type: 'varchar', length: 50 })
  paymentMethod: string;

  @Column({ name: 'operation_reference', type: 'varchar', length: 100, nullable: true })
  operationReference: string | null;

  @Column({ name: 'payment_number', type: 'varchar', length: 50, nullable: true })
  paymentNumber: string | null;

  @Column({ name: 'registered_by', type: 'uuid' })
  registeredBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  // Relaciones
  @ManyToOne(() => TenantEntity)
  @JoinColumn({ name: 'tenant_id' })
  tenant: TenantEntity;

  @ManyToOne(() => DailyTicketEntity, { nullable: true })
  @JoinColumn({ name: 'daily_ticket_id' })
  dailyTicket: DailyTicketEntity | null;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'registered_by' })
  user: UserEntity;
}
