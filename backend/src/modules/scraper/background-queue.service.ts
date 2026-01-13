// backend/src/modules/scraper/background-queue.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../../entities/category.entity';

export interface QueueJob {
  type: 'refresh-category' | 'refresh-navigation' | 'full-scan' | 'refresh-stale';
  target: string;
  priority: 'high' | 'medium' | 'low';
  triggeredBy: 'system' | 'user' | 'scheduler';
  metadata?: any;
}

@Injectable()
export class BackgroundQueueService implements OnModuleInit {
  private readonly logger = new Logger(BackgroundQueueService.name);

  constructor(
    @InjectQueue('background-scraping')
    private readonly backgroundQueue: Queue,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
  ) {}

  async onModuleInit() {
    // Start background jobs on startup
    this.logger.log('Background queue service initialized');
    
    // Queue initial jobs with delay
    setTimeout(() => {
      this.queueInitialJobs().catch(err => {
        this.logger.error('Failed to queue initial jobs:', err);
      });
    }, 10000); // 10 second delay
  }

  async queueInitialJobs(): Promise<void> {
    this.logger.log('Queueing initial background jobs...');
    
    // Queue navigation refresh (high priority)
    await this.queueNavigationRefresh('system');
    
    // Queue stale categories refresh (medium priority)
    await this.queueStaleCategoriesRefresh();
    
    // Queue full scan (low priority, delayed)
    setTimeout(async () => {
      await this.queueFullSiteScan();
    }, 60000); // 1 minute delay
    
    this.logger.log('Initial background jobs queued');
  }

  async queueNavigationRefresh(triggeredBy: 'system' | 'user' = 'system'): Promise<void> {
    await this.backgroundQueue.add('refresh-navigation', {
      type: 'refresh-navigation',
      target: 'all',
      priority: 'high',
      triggeredBy,
    });
    
    this.logger.log(`Navigation refresh queued (triggered by: ${triggeredBy})`);
  }

  async queueCategoryRefresh(categorySlug: string, triggeredBy: 'system' | 'user' = 'user'): Promise<void> {
    await this.backgroundQueue.add('refresh-category', {
      type: 'refresh-category',
      target: categorySlug,
      priority: 'high',
      triggeredBy,
    });
    
    this.logger.log(`Category ${categorySlug} refresh queued (triggered by: ${triggeredBy})`);
  }

  async queueStaleCategoriesRefresh(): Promise<void> {
    const staleCategories = await this.getStaleCategories(10); // Get 10 stale categories
    
    for (const category of staleCategories) {
      await this.backgroundQueue.add('refresh-stale', {
        type: 'refresh-stale',
        target: category.slug,
        priority: 'medium',
        triggeredBy: 'system',
        metadata: {
          categoryId: category.id,
          lastScraped: category.last_scraped_at,
        },
      });
    }
    
    this.logger.log(`Queued ${staleCategories.length} stale categories for refresh`);
  }

  async queueFullSiteScan(): Promise<void> {
    await this.backgroundQueue.add('full-scan', {
      type: 'full-scan',
      target: 'all',
      priority: 'low',
      triggeredBy: 'system',
    });
    
    this.logger.log('Full site scan queued (low priority)');
  }

  async getQueueStats(): Promise<any> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.backgroundQueue.getWaitingCount(),
      this.backgroundQueue.getActiveCount(),
      this.backgroundQueue.getCompletedCount(),
      this.backgroundQueue.getFailedCount(),
      this.backgroundQueue.getDelayedCount(),
    ]);
    
    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
      timestamp: new Date(),
    };
  }

  async clearQueue(): Promise<void> {
    // BullMQ clean signature: clean(grace: number, limit?: number, status?: JobStatusClean)
    // Remove completed/failed jobs
    try {
      await this.backgroundQueue.clean(60000);
    } catch (error) {
      this.logger.warn('Failed to clean queue:', error.message);
    }
    
    this.logger.log('Background queue cleared');
  }

  private async getStaleCategories(limit: number): Promise<Category[]> {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    
    return this.categoryRepo
      .createQueryBuilder('category')
      .where('category.last_scraped_at < :date OR category.last_scraped_at IS NULL', {
        date: twentyFourHoursAgo,
      })
      .orderBy('category.last_scraped_at', 'ASC')
      .take(limit)
      .getMany();
  }
}