import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { UserEntity } from './user.entity';
import { RegisterStatus } from '@shared/domain/enums/register-status.enum';

@Entity('driver_info')
export class DriverInfoEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId: string;

  @Column({ name: 'license_number', type: 'varchar', length: 20 })
  licenseNumber: string;

  @Column({ name: 'license_expiry', type: 'date' })
  licenseExpiry: Date;

  @Column({ type: 'varchar', length: 15, unique: true })
  dni: string;

  @Column({ name: 'phone_emergency', type: 'varchar', length: 20, nullable: true })
  phoneEmergency: string;

  @Column({
    type: 'enum',
    enum: RegisterStatus,
    default: RegisterStatus.ACTIVE,
  })
  status: RegisterStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}
