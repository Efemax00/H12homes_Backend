import { Module } from '@nestjs/common';
import { ChatsService } from '../agent-user-chat/agent-user-chat.service';
import { ChatsController } from '../agent-user-chat/agent-user-chat.controller';
import { ChatsGateway } from '../agent-user-chat/chat.gateway';

import { PrismaModule } from '../../prisma/prisma.module';
import { ItemsModule } from '../items/items.module';
import { ChatModule } from '../chat/chat.module';
import { ReservationFeePaymentService } from '../payment/reservation-fee-payment.service';
import {PaystackModule} from '../paystack/paystack.module';




@Module({
  imports: [
    PrismaModule,   // ✅ provides PrismaService
    ItemsModule,    // ✅ provides ItemsService (must be exported from ItemsModule)
    ChatModule, 
    PaystackModule, // ✅ provides PaystackService (must be exported from PaystackModule)
  ],
  controllers: [ChatsController],
  providers: [ChatsService,ReservationFeePaymentService, ChatsGateway],
  exports: [ChatsService, ChatsGateway],
})
export class ChatsModule {}
