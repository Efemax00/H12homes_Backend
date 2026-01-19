import { Module } from '@nestjs/common';
import { LandlordsService } from './landlords.service';
import { LandlordsController } from './landlords.controller';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [LandlordsController],
  providers: [LandlordsService, PrismaService],
  exports: [LandlordsService],
})
export class LandlordsModule {}
