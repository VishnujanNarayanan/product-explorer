// backend/src/modules/scraper/processors/background.processor.ts
import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, IsNull } from 'typeorm';

import { CategoryScraper } from '../scrapers/category.scraper';
import { NavigationScraper } from '../scrapers/navigation.scraper';

import { Navigation } from '../../../entities/navigation.entity';
import { Category } from '../../../entities/category.entity';
import { Product } from '../../../entities/product.entity';
import { ScrapeJob } from '../../../entities/scrape-job.entity';

export interface BackgroundScrapeJob {
  type: 'full-scan' | 'refresh-stale' | 'priority-category';
  target?: string;
  priority: 'high' | 'medium' | 'low';
  triggeredBy: 'system' | 'user' | 'scheduler';
}

@Injectable()
@Processor('background-scraping')
export class BackgroundScraperProcessor {
  private readonly logger = new Logger(BackgroundScraperProcessor.name);

  constructor(
    @InjectRepository(Navigation)
    private navigationRepo: Repository<Navigation>,
    @InjectRepository(Category)
    private categoryRepo: Repository<Category>,
    @InjectRepository(Product)
    private productRepo: Repository<Product>,
    @InjectRepository(ScrapeJob)
    private scrapeJobRepo: Repository<ScrapeJob>,
    
    private readonly categoryScraper: CategoryScraper,
    private readonly navigationScraper: NavigationScraper,
  ) {}

  /**
   * High priority: Refresh specific category (user requested)
   */
  @Process('refresh-category')
  async handleCategoryRefresh(job: Job<BackgroundScrapeJob>) {
    const { target, triggeredBy } = job.data;
    this.logger.log(`[HIGH] Refreshing category: ${target} (triggered by: ${triggeredBy})`);
    
    const scrapeJob = await this.scrapeJobRepo.save({
      target_url: `https://www.worldofbooks.com/collections/${target}`,
      target_type: 'category',
      status: 'processing',
      started_at: new Date(),
      priority: 'high',
    });

    try {
      // Scrape with higher priority (shorter delays)
      const products = await this.categoryScraper.scrape(
        `https://www.worldofbooks.com/collections/${target}`,
        target,
        120 // Max products
      );

      await this.saveCategoryProducts(target, products);
      
      await this.scrapeJobRepo.update(scrapeJob.id, {
        status: 'completed',
        finished_at: new Date(),
      });

      this.logger.log(`[HIGH] Category ${target} refreshed: ${products.length} products`);
      
    } catch (error) {
      this.logger.error(`[HIGH] Failed to refresh category ${target}:`, error);
      await this.scrapeJobRepo.update(scrapeJob.id, {
        status: 'failed',
        finished_at: new Date(),
        error_log: error.message,
      });
      throw error;
    }
  }

  /**
   * Medium priority: Refresh stale categories (> 24 hours old)
   */
  @Process('refresh-stale')
  async handleStaleRefresh(job: Job<BackgroundScrapeJob>) {
    this.logger.log('[MEDIUM] Refreshing stale categories');
    
    // Find categories not scraped in last 24 hours
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    
    const staleCategories = await this.categoryRepo.find({
      where: [
        { last_scraped_at: LessThan(twentyFourHoursAgo) },
        { last_scraped_at: IsNull() },
      ],
      take: 5, // Limit to 5 categories per job
    });

    this.logger.log(`[MEDIUM] Found ${staleCategories.length} stale categories`);

    for (const category of staleCategories) {
      try {
        // Scrape with normal delays
        const products = await this.categoryScraper.scrape(
          `https://www.worldofbooks.com/collections/${category.slug}`,
          category.slug,
          40, // Less products for background refresh
          undefined,

        );

        await this.saveCategoryProducts(category.slug, products);
        
        this.logger.log(`[MEDIUM] Refreshed stale category ${category.slug}: ${products.length} products`);
        
        // Small delay between categories
        await new Promise(resolve => setTimeout(resolve, 5000));
        
      } catch (error) {
        this.logger.warn(`[MEDIUM] Failed to refresh stale category ${category.slug}:`, error.message);
        // Continue with next category
      }
    }
  }

  /**
   * Low priority: Full site scan (all categories)
   */
  @Process('full-scan')
  async handleFullSiteScan(job: Job<BackgroundScrapeJob>) {
    this.logger.log('[LOW] Starting full site scan');
    
    // Get all categories
    const allCategories = await this.categoryRepo.find({
      select: ['id', 'slug', 'title'],
    });

    this.logger.log(`[LOW] Will scan ${allCategories.length} categories`);

    let processed = 0;
    for (const category of allCategories) {
      try {
        // Very slow scraping for background (respectful to target site)
        const products = await this.categoryScraper.scrape(
          `https://www.worldofbooks.com/collections/${category.slug}`,
          category.slug,
          20, // Very few products for full scan
          undefined,

        );

        await this.saveCategoryProducts(category.slug, products);
        
        processed++;
        this.logger.log(`[LOW] Scanned ${category.slug} (${processed}/${allCategories.length}): ${products.length} products`);
        
        // Long delay between categories for full scan
        await new Promise(resolve => setTimeout(resolve, 10000));
        
      } catch (error) {
        this.logger.warn(`[LOW] Failed to scan category ${category.slug}:`, error.message);
        // Continue with next category
      }
    }
    
    this.logger.log(`[LOW] Full scan completed: ${processed}/${allCategories.length} categories processed`);
  }

  /**
   * High priority: Navigation refresh
   */
  @Process('refresh-navigation')
  async handleNavigationRefresh(job: Job<BackgroundScrapeJob>) {
    this.logger.log('[HIGH] Refreshing navigation data');
    
    const scrapeJob = await this.scrapeJobRepo.save({
      target_url: 'https://www.worldofbooks.com',
      target_type: 'navigation',
      status: 'processing',
      started_at: new Date(),
      priority: 'high',
    });

    try {
      const { navigation, categories } = await this.navigationScraper.scrape(
        'https://www.worldofbooks.com'
      );

      // Save navigation
      for (const navItem of navigation) {
        const existing = await this.navigationRepo.findOne({ where: { slug: navItem.slug } });
        
        if (existing) {
          existing.last_scraped_at = new Date();
          await this.navigationRepo.save(existing);
        } else {
          const newNav = this.navigationRepo.create({
            title: navItem.title,
            slug: navItem.slug,
            last_scraped_at: new Date(),
          });
          await this.navigationRepo.save(newNav);
        }
      }

      // Save categories
      for (const categoryItem of categories) {
        const parentNav = await this.navigationRepo.findOne({ 
          where: { slug: categoryItem.parentSlug } 
        });

        const existingCategory = await this.categoryRepo.findOne({ 
          where: { slug: categoryItem.slug } 
        });

        if (existingCategory) {
          existingCategory.last_scraped_at = new Date();
          await this.categoryRepo.save(existingCategory);
        } else if (parentNav) {
          const newCategory = this.categoryRepo.create({
            title: categoryItem.title,
            slug: categoryItem.slug,
            navigation: parentNav,
            last_scraped_at: new Date(),
          });
          await this.categoryRepo.save(newCategory);
        }
      }

      await this.scrapeJobRepo.update(scrapeJob.id, {
        status: 'completed',
        finished_at: new Date(),
      });

      this.logger.log(`[HIGH] Navigation refreshed: ${navigation.length} nav items, ${categories.length} categories`);
      
    } catch (error) {
      this.logger.error('[HIGH] Failed to refresh navigation:', error);
      await this.scrapeJobRepo.update(scrapeJob.id, {
        status: 'failed',
        finished_at: new Date(),
        error_log: error.message,
      });
      throw error;
    }
  }

  private async saveCategoryProducts(categorySlug: string, products: any[]): Promise<void> {
    const category = await this.categoryRepo.findOne({
      where: { slug: categorySlug },
    });

    if (!category) {
      this.logger.warn(`Category ${categorySlug} not found`);
      return;
    }

    let saved = 0;
    let updated = 0;
    
    for (const productData of products) {
      try {
        const existingProduct = await this.productRepo.findOne({
          where: { source_id: productData.source_id },
        });

        if (existingProduct) {
          // Update
          existingProduct.title = productData.title;
          existingProduct.price = productData.price;
          existingProduct.image_url = productData.image_url;
          existingProduct.last_scraped_at = new Date();
          await this.productRepo.save(existingProduct);
          updated++;
        } else {
          // Create
          const newProduct = this.productRepo.create({
            source_id: productData.source_id,
            title: productData.title,
            price: productData.price,
            currency: productData.currency || 'GBP',
            image_url: productData.image_url || '',
            source_url: productData.source_url,
            category,
            last_scraped_at: new Date(),
          });
          await this.productRepo.save(newProduct);
          saved++;
        }
      } catch (error) {
        this.logger.debug(`Failed to save product ${productData.source_id}:`, error.message);
      }
    }

    // Update category stats
    category.product_count = await this.productRepo.count({ 
      where: { category: { id: category.id } } 
    });
    category.last_scraped_at = new Date();
    await this.categoryRepo.save(category);

    this.logger.log(`Saved ${saved} new, updated ${updated} products for ${categorySlug}`);
  }
}