import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ItemsService } from './items.service';
import { ItemsController } from './items.controller';
import { PrismaModule } from '../../prisma/prisma.module'; 
import { CloudinaryModule } from '../cloudinary/cloudinary.module'; 

@Module({
  imports: [PrismaModule, CloudinaryModule, JwtModule],
  controllers: [ItemsController],
  providers: [ItemsService],
})
export class ItemsModule {}