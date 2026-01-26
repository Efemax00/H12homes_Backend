import { Module } from '@nestjs/common';
import { AgentsService } from '../agents/agent.service';
import { AgentsController } from '../agents/agent.controller';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [AgentsController],
  providers: [AgentsService, PrismaService],
  exports: [AgentsService],
})
export class AgentsModule {}