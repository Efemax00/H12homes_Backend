// src/payment/payment.module.ts
import { Module } from '@nestjs/common';
import { PaymentController } from '../payment/payment.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { ViewingFeePaymentService } from './viewing-fee-payment.service';
import { PaystackModule } from '../paystack/paystack.module';


@Module({
  imports: [PrismaModule, PaystackModule],
  controllers: [PaymentController],
  providers: [CloudinaryService, ViewingFeePaymentService],
})
export class PaymentModule {}
