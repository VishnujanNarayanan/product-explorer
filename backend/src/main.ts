// backend/src/main.ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  app.useWebSocketAdapter(new IoAdapter(app));

  app.useGlobalPipes(
    new ValidationPipe({
      // Strip properties with no decorator, then reject the request if any were present.
      // Together these stop unexpected input reaching a service or a query builder.
      whitelist: true,
      forbidNonWhitelisted: true,
      // Required for @Type()/@Transform: path and query values arrive as strings, so DTOs
      // are plain objects with string fields until class-transformer converts them.
      transform: true,
      // Keep validation messages out of production responses in case one ever quotes input.
      disableErrorMessages: process.env.NODE_ENV === 'production',
    }),
  );

  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`CORS origins: ${allowedOrigins.join(', ')}`);
}

bootstrap();
