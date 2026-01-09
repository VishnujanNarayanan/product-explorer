import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ScraperService } from './scraper.service';
import { ScrapeProcessor } from './processors/scrape.processor';
import { NavigationScraper } from './scrapers/navigation.scraper';
import { CategoryScraper } from './scrapers/category.scraper';
import { ProductScraper } from './scrapers/product.scraper';
import { ProductDetailScraper } from './scrapers/product-detail.scraper';

import { Navigation } from '../../entities/navigation.entity';
import { Category } from '../../entities/category.entity';
import { Product } from '../../entities/product.entity';
import { ProductDetail } from '../../entities/product-detail.entity';
import { Review } from '../../entities/review.entity';
import { ScrapeJob } from '../../entities/scrape-job.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Navigation,
      Category,
      Product,
      ProductDetail,
      Review,
      ScrapeJob,
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
    ScraperService,
    ScrapeProcessor,
    NavigationScraper,
    CategoryScraper,
    ProductScraper,
    ProductDetailScraper,
  ],
  exports: [ScraperService],
})
export class ScraperModule {}