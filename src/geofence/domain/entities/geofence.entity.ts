import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { TenantEntity } from '@tenant/domain/entities/tenant.entity';
import { RegisterStatus } from '@shared/domain/enums/register-status.enum';

export enum GeofenceType {
  START = 'START',
  CHECKPOINT = 'CHECKPOINT',
  END = 'END',
}

@Entity('geofences')
@Unique(['tenantId', 'traccarGeofenceId'])
export class GeofenceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'traccar_geofence_id', type: 'int' })
  traccarGeofenceId: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({
    type: 'enum',
    enum: GeofenceType,
  })
  type: GeofenceType;

  @Column({
    type: 'enum',
    enum: RegisterStatus,
    default: RegisterStatus.ACTIVE,
  })
  status: RegisterStatus;

  @ManyToOne(() => TenantEntity)
  @JoinColumn({ name: 'tenant_id' })
  tenant: TenantEntity;

  // Propiedades virtuales (no persistidas en BD, se cargan dinámicamente de Traccar)
  lat?: number;
  lng?: number;
}
