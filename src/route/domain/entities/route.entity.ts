import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { TenantEntity } from '@tenant/domain/entities/tenant.entity';
import { RouteStopEntity } from './route-stop.entity';

@Entity('routes')
export class RouteEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'outbound_coordinates', type: 'jsonb', nullable: true })
  outboundCoordinates?: { lat: number; lng: number }[];

  @Column({ name: 'inbound_coordinates', type: 'jsonb', nullable: true })
  inboundCoordinates?: { lat: number; lng: number }[];

  @Column({ name: 'traccar_group_id', type: 'int', nullable: true })
  traccarGroupId?: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => TenantEntity)
  @JoinColumn({ name: 'tenant_id' })
  tenant: TenantEntity;

  @OneToMany(() => RouteStopEntity, (stop) => stop.route)
  stops: RouteStopEntity[];
}
