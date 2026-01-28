import { Module } from '@nestjs/common';
import { ChatsService } from '../agent-user-chat/agent-user-chat.service';
import { ChatsController } from '../agent-user-chat/agent-user-chat.controller';
import { ChatsGateway } from '../agent-user-chat/chat.gateway';

import { PrismaModule } from '../../prisma/prisma.module';
import { ItemsModule } from '../items/items.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    PrismaModule,   // ✅ provides PrismaService
    ItemsModule,    // ✅ provides ItemsService (must be exported from ItemsModule)
    ChatModule,     // ✅ provides ChatService (must be exported from ChatModule)
  ],
  controllers: [ChatsController],
  providers: [ChatsService, ChatsGateway],
  exports: [ChatsService, ChatsGateway],
})
export class ChatsModule {}
