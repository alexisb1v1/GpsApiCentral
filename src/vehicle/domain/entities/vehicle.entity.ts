import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { TenantEntity } from '@tenant/domain/entities/tenant.entity';

export enum VehicleStatus {
  OPERATIVO = 'OPERATIVO',
  TALLER = 'TALLER',
  BAJA = 'BAJA',
}

@Entity('vehicles')
export class VehicleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  plate: string;

  @Column({ name: 'traccar_device_id', type: 'varchar', length: 50, unique: true, nullable: true })
  traccarDeviceId: string | null;

  @Column({ type: 'varchar', length: 50 })
  brand: string;

  @Column({ type: 'varchar', length: 50 })
  model: string;

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'varchar', length: 30, nullable: true })
  color: string | null;

  @Column({
    type: 'enum',
    enum: VehicleStatus,
    default: VehicleStatus.OPERATIVO,
  })
  status: VehicleStatus;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => TenantEntity)
  @JoinColumn({ name: 'tenant_id' })
  tenant: TenantEntity;
}
