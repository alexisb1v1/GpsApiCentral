import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentEntity } from '../../domain/entities/payment.entity';
import { TypeOrmPaymentRepository } from '../persistence/typeorm-payment.repository';

const Repositories = [
  {
    provide: 'PaymentRepository',
    useClass: TypeOrmPaymentRepository,
  },
];

@Module({
  imports: [TypeOrmModule.forFeature([PaymentEntity])],
  providers: [...Repositories],
  exports: ['PaymentRepository', TypeOrmModule],
})
export class PaymentModule {}
