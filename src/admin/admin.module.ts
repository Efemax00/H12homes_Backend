// src/admin/admin.module.ts
import { Module, forwardRef} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [AdminController],
  providers: [AdminService, PrismaService],
})
export class AdminModule {}
