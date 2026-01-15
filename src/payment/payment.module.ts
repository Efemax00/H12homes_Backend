// src/payment/payment.module.ts
import { Module } from '@nestjs/common';
import { PaymentController } from '../payment/payment.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Module({
  imports: [PrismaModule],
  controllers: [PaymentController],
  providers: [CloudinaryService],
})
export class PaymentModule {}
