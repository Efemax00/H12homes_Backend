// src/payment/payment.module.ts
import { Module } from '@nestjs/common';
import { PaymentController } from '../payment/payment.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PaymentController],
})
export class PaymentModule {}
