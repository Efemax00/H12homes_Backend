import { Module } from '@nestjs/common';
import { ItemsService } from './items.service';
import { ItemsController } from './items.controller';
import { PrismaModule } from '../../prisma/prisma.module'; // ✅ ADDED
import { CloudinaryModule } from '../cloudinary/cloudinary.module'; // ✅ ADDED

@Module({
  imports: [PrismaModule, CloudinaryModule], // ✅ ADDED - Import both modules
  controllers: [ItemsController],
  providers: [ItemsService],
})
export class ItemsModule {}