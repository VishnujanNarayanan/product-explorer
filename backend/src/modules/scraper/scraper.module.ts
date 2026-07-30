// backend/src/modules/scraper/scraper.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ScraperService } from './scraper.service';
import { ScraperSessionService } from './scraper-session.service';
import { ScrapeProcessor } from './processors/scrape.processor';
import { BackgroundScraperProcessor } from './processors/background.processor';
import { NavigationScraper } from './scrapers/navigation.scraper';
import { CategoryScraper } from './scrapers/category.scraper';
import { ProductScraper } from './scrapers/product.scraper';
import { ProductDetailScraper } from './scrapers/product-detail.scraper';
import { InteractiveScraper } from './scrapers/interactive.scraper';
import { WebSocketGateway } from '../../websocket/websocket.gateway';
import { redisConnection, redisConnectionUrl } from '../../config/connection.config';

import { Navigation } from '../../entities/navigation.entity';
import { Category } from '../../entities/category.entity';
import { Product } from '../../entities/product.entity';
import { ProductDetail } from '../../entities/product-detail.entity';
import { Review } from '../../entities/review.entity';
import { ScrapeJob } from '../../entities/scrape-job.entity';
import { ScraperSession } from '../../entities/scraper-session.entity';
import { ViewHistory } from '../../entities/view-history.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Navigation,
      Category,
      Product,
      ProductDetail,
      Review,
      ScrapeJob,
      ScraperSession,
      ViewHistory,
    ]),
    BullModule.registerQueue({
      name: 'scraping',
      redis: redisConnection(),
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    }),
    BullModule.registerQueue({
      name: 'background-scraping',
      redis: redisConnection(),
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 10000,
        },
        priority: 1, // Lower priority than real-time scraping
      },
    }),
    CacheModule.registerAsync({
      useFactory: async () => ({
        store: redisStore,
        // A URL, not host/port: this store passes its config straight to node-redis v4, which
        // reads `url` and silently ignores loose host/port keys — so the old shape connected to
        // localhost no matter what REDIS_HOST said, and could only ever work in development.
        url: redisConnectionUrl(),
        // Without this, node-redis accepts commands while disconnected and holds them until it
        // reconnects, so a cache read during an outage never settles. Failing immediately is
        // the right behaviour for a cache: the caller falls back to Postgres.
        disableOfflineQueue: true,
        ttl: parseInt(process.env.CACHE_TTL || '86400'), // 24 hours
        max: 1000, // Maximum number of items in cache
      }),
    }),
  ],
  providers: [
    // Core Services
    ScraperService,
    ScraperSessionService,
    
    // Queue Processors
    ScrapeProcessor,
    BackgroundScraperProcessor,
    
    // Scrapers
    NavigationScraper,
    CategoryScraper,
    ProductScraper,
    ProductDetailScraper,
    InteractiveScraper,

    // Real-time updates
    WebSocketGateway,
  ],
  exports: [
    ScraperService,
    ScraperSessionService,
    NavigationScraper,
    CategoryScraper,
    ProductScraper,
    ProductDetailScraper,
    InteractiveScraper,
  ],
})
export class ScraperModule {}