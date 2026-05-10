import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { RegisterStatus } from '@shared/domain/enums/register-status.enum';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  role: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  password: string;

  @Column({
    name: 'is_active',
    type: 'enum',
    enum: RegisterStatus,
    default: RegisterStatus.OPERATIVO,
  })
  status: RegisterStatus;
}
