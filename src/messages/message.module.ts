// src/messages/messages.module.ts
import { Module } from '@nestjs/common';
import { MessagesController } from '../messages/message.controller';
import { MessagesService } from '../messages/message.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}