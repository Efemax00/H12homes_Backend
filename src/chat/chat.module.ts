import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ItemsModule } from 'src/items/items.module';
import { PrismaModule } from '../../prisma/prisma.module'; 



@Module({
  controllers: [ChatController],
  providers: [ChatService],
  imports: [ItemsModule, PrismaModule],
  exports: [ChatService],
})
export class ChatModule {}