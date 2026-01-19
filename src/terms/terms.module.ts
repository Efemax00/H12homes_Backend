// src/terms/terms.module.ts
import { Module } from '@nestjs/common';
import { TermsService } from './terms.service';
import { TermsController } from './terms.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [TermsService],
  controllers: [TermsController],
  exports: [TermsService],
})
export class TermsModule {}
