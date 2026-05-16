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

  @Column({ name: 'traccar_device_id', type: 'int', unique: true, nullable: true })
  traccarDeviceId: number | null;



  @Column({ name: 'manufacturing_year', type: 'int' })
  year: number;



  @Column({
    type: 'enum',
    enum: VehicleStatus,
    default: VehicleStatus.OPERATIVO,
  })
  status: VehicleStatus;

  @Column({ name: 'passenger_capacity', type: 'int', nullable: true })
  passengerCapacity: number | null;

  @Column({ name: 'owner_name', type: 'varchar', length: 150, nullable: true })
  ownerName: string | null;

  @Column({ name: 'owner_phone', type: 'varchar', length: 20, nullable: true })
  ownerPhone: string | null;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;



  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => TenantEntity)
  @JoinColumn({ name: 'tenant_id' })
  tenant: TenantEntity;
}
