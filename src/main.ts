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

  app.enableCors({
  origin: [
    'http://localhost:5173',
    'https://h12homes.web.app',
    'https://h12homes.shop',
    'https://admin.h12homes.shop',
    'https://admin.h12homes.web.app',
    'https://h12homes.com',
  ],
  credentials: true,
});


  const port = process.env.PORT || 3000;
await app.listen(port);
console.log(`✅ Application is running on http://localhost:${port}`);
}

bootstrap();
