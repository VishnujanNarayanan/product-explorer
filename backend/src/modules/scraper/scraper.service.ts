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

      return savedNavigation;
    } catch (error) {
      this.logger.error(`Navigation scraping failed: ${error.message}`);
      throw error;
    }
  }

  async scrapeCategoryBySlug(slug: string): Promise<Product[]> {
    const cacheKey = `category_${slug}`;
    const cached = await this.cacheManager.get(cacheKey);
    
    if (cached) {
      this.logger.log(`Returning cached products for category: ${slug}`);
      return cached as Product[];
    }

    const category = await this.categoryRepo.findOne({ where: { slug } });
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
    });

    // Cache for 1 hour
    await this.cacheManager.set(cacheKey, products, 60 * 60 * 1000);
    
    return products;
  }

  async scrapeProductBySourceId(sourceId: string, forceRefresh = false): Promise<Product | null> {
    const cacheKey = `product_${sourceId}`;
    
    if (!forceRefresh) {
        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
        return cached as Product;
        }
    }

    const product = await this.productRepo.findOne({ 
        where: { source_id: sourceId },
        relations: ['detail', 'reviews', 'category'],
    });

    if (product && !forceRefresh) {
        // Cache for 24 hours
        await this.cacheManager.set(cacheKey, product, 24 * 60 * 60 * 1000);
        return product;
    }

    // Queue detail scraping job
    if (product) {
        await this.scrapingQueue.add('scrape-product-detail', {
        productId: product.id,
        url: product.source_url,
        sourceId: product.source_id,
        });
    }

    return product; 
    }

  async triggerOnDemandScrape(type: 'navigation' | 'category' | 'product', target: string): Promise<string> {
    const job = await this.scrapeJobRepo.save({
      target_url: target,
      target_type: type,
      status: 'pending',
      started_at: new Date(),
    });

    switch (type) {
      case 'navigation':
        await this.scrapingQueue.add('scrape-navigation', { jobId: job.id });
        break;
      case 'category':
        await this.scrapingQueue.add('scrape-category', { 
          categorySlug: target,
          jobId: job.id 
        });
        break;
      case 'product':
        await this.scrapingQueue.add('scrape-product-detail', { 
          sourceId: target,
          jobId: job.id 
        });
        break;
    }

    return `Job ${job.id} queued for ${type} scrape`;
  }

  async getScrapeJobStatus(jobId: number): Promise<ScrapeJob> {
    return this.scrapeJobRepo.findOne({ where: { id: jobId } }) as Promise<ScrapeJob>;
  }

  async clearCache(): Promise<void> {
    const cache = this.cacheManager as any;
    await cache.store.reset?.();
    this.logger.log('Cache cleared');
  }
}