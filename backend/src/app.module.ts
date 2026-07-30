import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Navigation } from './entities/navigation.entity';
import { Category } from './entities/category.entity';
import { Product } from './entities/product.entity';
import { ProductDetail } from './entities/product-detail.entity';
import { Review } from './entities/review.entity';
import { ScrapeJob } from './entities/scrape-job.entity';
import { ScraperSession } from './entities/scraper-session.entity';
import { ViewHistory } from './entities/view-history.entity';
import { CoreModule } from './modules/core/core.module';
import { ProductsModule } from './modules/products/products.module';
import { ScraperModule } from './modules/scraper/scraper.module';
import { postgresConnection, redisConnection } from './config/connection.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // .env lives at the repo root, one level above backend/ (the cwd for npm scripts)
      envFilePath: ['.env', '../.env'],
    }),
    TypeOrmModule.forRoot({
      ...postgresConnection(),
      entities: [
        Navigation,
        Category,
        Product,
        ProductDetail,
        Review,
        ScrapeJob,
        ScraperSession,
        ViewHistory,
      ],
      synchronize: process.env.NODE_ENV === 'development',
      logging: process.env.NODE_ENV === 'development',
    }),
    BullModule.forRoot({
      redis: redisConnection(),
    }),
    CoreModule,
    // Was never registered, so GET /api/products returned 404 for every caller — including
    // the frontend's own getAllProducts().
    ProductsModule,
    ScraperModule, // WebSocketGateway should be provided by ScraperModule
  ],
  controllers: [AppController],
  providers: [AppService], // REMOVED WebSocketGateway from here
})
export class AppModule {}