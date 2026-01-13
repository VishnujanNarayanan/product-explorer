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
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
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
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
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
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
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