import { Module } from '@nestjs/common';
import { ChatsService } from '../agent-user-chat/agent-user-chat.service';
import { ChatsController } from '../agent-user-chat/agent-user-chat.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatsGateway } from '../agent-user-chat/chat.gateway';

@Module({
  controllers: [ChatsController],
  providers: [ChatsService, ChatsGateway, PrismaService],
  exports: [ChatsService, ChatsGateway],
})
export class ChatsModule {}