import { PaymentEntity } from '../entities/payment.entity';
import { Result } from 'neverthrow';
import { AppError } from '@shared/domain/errors/app-errors';

export interface PaymentRepository {
  save(payment: PaymentEntity): Promise<Result<PaymentEntity, AppError>>;
  findById(id: string): Promise<Result<PaymentEntity, AppError>>;
}
