import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('tenants')
export class TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  subdomain: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'logo_url', type: 'text', nullable: true })
  logoUrl: string | null;

  @Column({ name: 'login_url', type: 'text', nullable: true })
  loginUrl: string | null;

  @Column({ name: 'primary_color', type: 'varchar', length: 7, nullable: true })
  primaryColor: string | null;

  @Column({ name: 'accent_color', type: 'varchar', length: 7, nullable: true })
  accentColor: string | null;

  @Column({ name: 'status_dot_color', type: 'varchar', length: 7, nullable: true })
  statusDotColor: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ name: 'tax_id', type: 'varchar', length: 20, nullable: true })
  taxId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
