import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('document_sequences')
export class DocumentSequenceEntity {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @PrimaryColumn({ name: 'document_type', type: 'varchar', length: 50 })
  documentType: string;

  @Column({ name: 'current_value', type: 'integer', default: 0 })
  currentValue: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  prefix: string | null;
}
