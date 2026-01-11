import type { Queue } from 'bull';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import type { Cache } from 'cache-manager';

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

@Injectable()
export class ScraperService implements OnModuleInit {
  private readonly logger = new Logger(ScraperService.name);
  private readonly BASE_URL = 'https://www.worldofbooks.com';

  constructor(
    private readonly navigationScraper: NavigationScraper,
    private readonly categoryScraper: CategoryScraper,
    private readonly productScraper: ProductScraper,
    private readonly productDetailScraper: ProductDetailScraper,
    
    @InjectRepository(Navigation)
    private navigationRepo: Repository<Navigation>,
    @InjectRepository(Category)
    private categoryRepo: Repository<Category>,
    @InjectRepository(Product)
    private productRepo: Repository<Product>,
    @InjectRepository(ProductDetail)
    private productDetailRepo: Repository<ProductDetail>,
    @InjectRepository(Review)
    private reviewRepo: Repository<Review>,
    @InjectRepository(ScrapeJob)
    private scrapeJobRepo: Repository<ScrapeJob>,
    
    @InjectQueue('scraping')
    private scrapingQueue: Queue<any>,
    
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async onModuleInit() {
    // Initialize with default navigation if empty
    const count = await this.navigationRepo.count();
    if (count === 0) {
      await this.scrapeAndSaveNavigation();
    }
  }

  async scrapeAndSaveNavigation(): Promise<Navigation[]> {
    const cacheKey = 'navigation_data';
    const cached = await this.cacheManager.get(cacheKey);
    
    if (cached) {
      this.logger.log('Returning cached navigation data');
      return cached as Navigation[];
    }

    try {
      const job = await this.scrapeJobRepo.save({
        target_url: this.BASE_URL,
        target_type: 'navigation',
        status: 'processing',
        started_at: new Date(),
      });

      const { navigation, categories } = await this.navigationScraper.scrape(this.BASE_URL);
      
      // Save navigation items
      const savedNavigation: Navigation[] = [];
      for (const navItem of navigation) {
        const existing = await this.navigationRepo.findOne({ where: { slug: navItem.slug } });
        
        if (existing) {
          existing.last_scraped_at = new Date();
          await this.navigationRepo.save(existing);
          savedNavigation.push(existing);
        } else {
          const newNav = this.navigationRepo.create({
            title: navItem.title,
            slug: navItem.slug,
            last_scraped_at: new Date(),
          });
          const saved = await this.navigationRepo.save(newNav);
          savedNavigation.push(saved);
        }
      }

      // Save categories with relationships
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

      await this.scrapeJobRepo.update(job.id, {
        status: 'completed',
        finished_at: new Date(),
      });

      // Cache for 24 hours
      await this.cacheManager.set(cacheKey, savedNavigation, 24 * 60 * 60 * 1000);

      this.logger.log(`Navigation scraping completed: ${savedNavigation.length} nav items, ${categories.length} categories saved`);
      return savedNavigation;
    } catch (error) {
      this.logger.error(`Navigation scraping failed: ${error.message}`);
      throw error;
    }
  }

  async scrapeCategoryBySlug(slug: string): Promise<{ 
    message: string; 
    products: Product[];
    category?: Category;
    jobQueued: boolean;
  }> {
    const cacheKey = `category_${slug}`;
    const cached = await this.cacheManager.get(cacheKey);
    
    if (cached) {
      this.logger.log(`Returning cached products for category: ${slug}`);
      return {
        message: `Returning cached products for ${slug}`,
        products: cached as Product[],
        jobQueued: false
      };
    }

    const category = await this.categoryRepo.findOne({ 
      where: { slug },
      relations: ['navigation']
    });
    
    if (!category) {
      throw new Error(`Category not found: ${slug}`);
    }

    // Queue scraping job
    await this.scrapingQueue.add('scrape-category', {
      categorySlug: slug,
      categoryId: category.id,
      url: `${this.BASE_URL}/collections/${slug}`,
    });

    // Return existing products immediately
    const products = await this.productRepo.find({
      where: { category: { id: category.id } },
      relations: ['category'],
      take: 50 // Limit for API response
    });

    // Cache for 1 hour
    await this.cacheManager.set(cacheKey, products, 60 * 60 * 1000);
    
    return {
      message: `Scraping job queued for category: ${slug}. Returning ${products.length} existing products.`,
      products,
      category,
      jobQueued: true
    };
  }

  async scrapeProductBySourceId(sourceId: string, forceRefresh = false): Promise<Product | null> {
    const cacheKey = `product_${sourceId}`;
    
    if (!forceRefresh) {
      const cached = await this.cacheManager.get<Product>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      // KEEP the relations - should work now with fixed entity
      const product = await this.productRepo.findOne({ 
        where: { source_id: sourceId },
        relations: ['detail', 'reviews', 'category'],
      });

      if (!product) {
        this.logger.warn(`Product not found: ${sourceId}`);
        return null;
      }

      // Always queue detail scrape if missing details or force refresh
      if (forceRefresh || !product.detail) {
        await this.scrapingQueue.add('scrape-product-detail', {
          productId: product.id,
          url: product.source_url,
          sourceId: product.source_id,
        });
      }

      // Cache for 24 hours
      await this.cacheManager.set(cacheKey, product, 24 * 60 * 60 * 1000);
      
      return product;
    } catch (error) {
      this.logger.error(`Error fetching product ${sourceId}: ${error.message}`);
      return null;
    }
  }

  async triggerOnDemandScrape(type: 'navigation' | 'category' | 'product', target: string): Promise<{ 
    success: boolean;
    message: string;
    jobId?: number;
  }> {
    const job = await this.scrapeJobRepo.save({
      target_url: target,
      target_type: type,
      status: 'pending',
      started_at: new Date(),
    });

    try {
      switch (type) {
        case 'navigation':
          // Use the target as URL or default to BASE_URL
          const url = target || this.BASE_URL;
          await this.scrapingQueue.add('scrape-navigation', { 
            jobId: job.id,
            url
          });
          break;
        
        case 'category':
          const category = await this.categoryRepo.findOne({ 
            where: { slug: target } 
          });
          
          if (!category) {
            throw new Error(`Category not found: ${target}`);
          }
          
          await this.scrapingQueue.add('scrape-category', { 
            categorySlug: target,
            categoryId: category.id,
            url: `${this.BASE_URL}/collections/${target}`,
            jobId: job.id 
          });
          break;
        
        case 'product':
          const product = await this.productRepo.findOne({ 
            where: { source_id: target } 
          });
          
          if (!product) {
            throw new Error(`Product not found: ${target}`);
          }
          
          await this.scrapingQueue.add('scrape-product-detail', { 
            sourceId: target,
            productId: product.id,
            url: product.source_url,
            jobId: job.id 
          });
          break;
      }

      return {
        success: true,
        message: `Job ${job.id} queued for ${type} scrape`,
        jobId: job.id
      };
    } catch (error) {
      // Update job status to failed
      await this.scrapeJobRepo.update(job.id, {
        status: 'failed',
        finished_at: new Date(),
        error_log: error.message
      });
      
      throw error;
    }
  }

  async getScrapeJobStatus(jobId: number): Promise<ScrapeJob> {
    return this.scrapeJobRepo.findOne({ where: { id: jobId } }) as Promise<ScrapeJob>;
  }
  async cleanupOldData(): Promise<{ deleted: number; message: string }> {
    try {
      // First, delete categories linked to old navigation
      const keepNavigationTitles = [
        'Clearance',
        'eGift Cards',
        'Fiction Books',
        'Non-Fiction Books',
        'Children\'s Books',
        'Rare Books',
        'Music & Film',
        'Sell Your Books'
      ];

      // Get IDs of navigation items to keep
      const keepNavigation = await this.navigationRepo
        .createQueryBuilder('nav')
        .select('nav.id')
        .where('nav.title IN (:...titles)', { titles: keepNavigationTitles })
        .getMany();

      const keepIds = keepNavigation.map(nav => nav.id);

      // 1. Delete categories that don't have valid navigation parent
      const deletedCategories = await this.categoryRepo
        .createQueryBuilder()
        .delete()
        .where('navigation_id NOT IN (:...ids)', { ids: keepIds.length > 0 ? keepIds : [0] })
        .execute();

      // 2. Delete old navigation items
      const deletedNavigation = await this.navigationRepo
        .createQueryBuilder()
        .delete()
        .where('title NOT IN (:...titles)', { titles: keepNavigationTitles })
        .execute();

      const totalDeleted = (deletedCategories.affected || 0) + (deletedNavigation.affected || 0);
      
      this.logger.log(`Cleaned up ${totalDeleted} items (${deletedCategories.affected || 0} categories, ${deletedNavigation.affected || 0} navigation)`);
      
      return {
        deleted: totalDeleted,
        message: `Cleaned up ${totalDeleted} items (${deletedCategories.affected || 0} categories, ${deletedNavigation.affected || 0} navigation)`
      };
    } catch (error) {
      this.logger.error(`Cleanup failed: ${error.message}`);
      return {
        deleted: 0,
        message: `Cleanup failed: ${error.message}`
      };
    }
  }

  async clearCache(): Promise<{ success: boolean; message: string }> {
    try {
      // Try different cache clearing methods
      const cache = this.cacheManager as any;
      
      if (cache.store?.reset) {
        await cache.store.reset();
      } else if (cache.store?.flushAll) {
        await cache.store.flushAll();
      } else if (cache.store?.clear) {
        await cache.store.clear();
      } else {
        // Manual cache key clearing for known keys
        const knownKeys = ['navigation_data'];
        for (const key of knownKeys) {
          await this.cacheManager.del(key);
        }
        
        // Clear category and product caches
        const categories = await this.categoryRepo.find();
        for (const category of categories) {
          await this.cacheManager.del(`category_${category.slug}`);
        }
        
        const products = await this.productRepo.find();
        for (const product of products) {
          await this.cacheManager.del(`product_${product.source_id}`);
        }
      }
      
      this.logger.log('Cache cleared successfully');
      return { success: true, message: 'Cache cleared successfully' };
      
    } catch (error) {
      this.logger.error(`Cache clear failed: ${error.message}`);
      return { success: false, message: `Cache clear failed: ${error.message}` };
    }
  }
}