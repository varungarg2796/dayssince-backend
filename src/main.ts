// dayssince-backend/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: process.env.FRONTEND_BASE_URL,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strips properties not in DTO
      transform: true, // Automatically transforms payloads to DTO instances
      forbidNonWhitelisted: true, // Optional: Throw error if extra properties are sent
      transformOptions: {
        enableImplicitConversion: true, // Allows auto-conversion for query params etc.
      },
    }),
  );
  await app.listen(3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
