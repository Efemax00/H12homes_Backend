import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';  // Add this
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { AdminModule } from './admin/admin.module';
import { ItemsModule } from './items/items.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    // Add ConfigModule to load .env file
    ConfigModule.forRoot({
      isGlobal: true,  // Makes it available everywhere
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 3,
      },
      {
        name: 'medium',
        ttl: 60000,
        limit: 20,
      },
      {
        name: 'long',
        ttl: 900000,
        limit: 100,
      },
    ]),
    PrismaModule,
    AuthModule,
    UserModule,
    AdminModule,
    ItemsModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}