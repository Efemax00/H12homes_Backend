import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(helmet());

  // Express middleware
  app.use(express.json());

  await app.listen(3000);
  console.log('✅ Application is running on http://localhost:3000');
}

bootstrap();
