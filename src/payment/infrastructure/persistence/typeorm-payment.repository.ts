import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Result, ok, err } from 'neverthrow';
import { PaymentEntity } from '../../domain/entities/payment.entity';
import { PaymentRepository } from '../../domain/repositories/payment.repository';
import { AppError } from '@shared/domain/errors/app-errors';

@Injectable()
export class TypeOrmPaymentRepository implements PaymentRepository {
  constructor(
    @InjectRepository(PaymentEntity)
    private readonly repository: Repository<PaymentEntity>,
  ) {}

  async save(payment: PaymentEntity): Promise<Result<PaymentEntity, AppError>> {
    try {
      const saved = await this.repository.save(payment);
      return ok(saved);
    } catch (error) {
      console.error('Error saving payment:', error);
      return err('INTERNAL_ERROR');
    }
  }

  async findById(id: string): Promise<Result<PaymentEntity, AppError>> {
    try {
      const payment = await this.repository.findOne({ where: { id } });
      if (!payment) return err('NOT_FOUND');
      return ok(payment);
    } catch (error) {
      console.error('Error finding payment by id:', error);
      return err('INTERNAL_ERROR');
    }
  }
}
