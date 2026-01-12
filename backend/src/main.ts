import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for frontend
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  
  // REMOVED: app.setGlobalPrefix('api');
  // Your CoreController already has @Controller('api')
  // This was causing double /api/api prefix
  
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`✅ Backend running on: http://localhost:${port}`);
  console.log(`📡 Test endpoint: http://localhost:${port}/api/navigation`);
}
bootstrap();