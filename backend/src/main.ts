// backend/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable WebSockets
  app.useWebSocketAdapter(new IoAdapter(app));

  // Enable CORS for BOTH frontend ports
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3001'], // ← ADD 3001 HERE
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}

bootstrap();