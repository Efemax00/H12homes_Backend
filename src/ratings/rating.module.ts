import { Module } from '@nestjs/common';
import { RatingsService } from './rating.service';
import { RatingsController } from './rating.controller';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [RatingsController],
  providers: [RatingsService, PrismaService],
  exports: [RatingsService],
})
export class RatingsModule {}