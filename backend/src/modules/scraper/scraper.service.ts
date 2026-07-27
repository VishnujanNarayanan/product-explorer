import type { Queue } from 'bull';
import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { In, Not } from 'typeorm';

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
  // World of Books serves all content under a locale prefix; omitting it redirects.
  private readonly LOCALE = '/en-gb';

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

      // Must be locale-qualified: the bare domain redirects and serves a reduced menu.
      const { navigation, categories } = await this.navigationScraper.scrape(
        `${this.BASE_URL}${this.LOCALE}`,
      );
      
      const savedNavigation: Navigation[] = [];
      for (const navItem of navigation) {
        const existing = await this.navigationRepo.findOne({ where: { slug: navItem.slug } });
        
        if (existing) {
          // Refresh the title too — a row may predate a change in how titles are read,
          // and only bumping the timestamp would leave stale text on the site forever.
          existing.title = navItem.title;
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

      for (const categoryItem of categories) {
        const parentNav = await this.navigationRepo.findOne({ 
          where: { slug: categoryItem.parentSlug } 
        });

        const existingCategory = await this.categoryRepo.findOne({ 
          where: { slug: categoryItem.slug } 
        });

        if (existingCategory) {
          existingCategory.title = categoryItem.title;
          if (parentNav) existingCategory.navigation = parentNav;
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

      // Never cache an empty result. A failed scrape used to be cached as valid, so every
      // retry within the TTL returned "cached" zero items and looked like a broken scraper.
      if (savedNavigation.length > 0) {
        await this.cacheManager.set(cacheKey, savedNavigation, 24 * 60 * 60 * 1000);
      } else {
        this.logger.warn('Navigation scrape returned no items — not caching');
      }

      this.logger.log(`Navigation scraping completed: ${savedNavigation.length} nav items, ${categories.length} categories saved`);
      return savedNavigation;
    } catch (error) {
      this.logger.error(`Navigation scraping failed: ${error.message}`);
      // Drop any stale entry so the next call retries instead of serving a bad cache hit.
      await this.cacheManager.del(cacheKey).catch(() => undefined);
      throw error;
    }
  }

  async scrapeCategoryBySlug(
    slug: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<{
    message: string;
    products: Product[];
    category?: Category;
    jobQueued: boolean;
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 24));

    // The page and size are part of the identity of the result. Caching on the slug alone
    // would serve page 1's rows for every subsequent page.
    const cacheKey = `category_${slug}_p${page}_l${limit}`;
    const cached = await this.cacheManager.get<{
      products: Product[];
      category?: Category;
      total: number;
    }>(cacheKey);

    // Only serve a cache hit that actually has products; an empty array means the previous
    // scrape failed and must not suppress a retry.
    if (cached && Array.isArray(cached.products) && cached.products.length > 0) {
      this.logger.log(`Returning cached products for category: ${slug} (page ${page})`);
      return {
        message: `Returning cached products for ${slug}`,
        products: cached.products,
        category: cached.category,
        jobQueued: false,
        total: cached.total,
        page,
        limit,
        hasMore: page * limit < cached.total,
      };
    }

    const category = await this.categoryRepo.findOne({
      where: { slug },
      relations: ['navigation']
    });

    if (!category) {
      // A missing category is a client error, not a server fault.
      throw new NotFoundException(`Category not found: ${slug}`);
    }

    // Queue another page only while the collection still has one. Fully-scraped categories
    // are served from the DB, so browsing them costs World of Books nothing.
    const jobQueued = !category.is_exhausted;
    if (jobQueued) {
      await this.scrapingQueue.add('scrape-category', {
        categorySlug: slug,
        categoryId: category.id,
        navigationSlug: category.navigation?.slug || null,
        url: this.collectionUrl(slug),
      });
    }

    const [products, total] = await this.productRepo.findAndCount({
      where: { category: { id: category.id } },
      relations: ['category'],
      order: { id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    if (products.length > 0) {
      await this.cacheManager.set(cacheKey, { products, category, total }, 60 * 60 * 1000);
    }

    return {
      message: jobQueued
        ? `Scraping job queued for category: ${slug}. Returning ${products.length} existing products.`
        : `Category ${slug} fully scraped. Returning ${products.length} products.`,
      products,
      category,
      jobQueued,
      total,
      page,
      limit,
      hasMore: page * limit < total,
    };
  }

  private collectionUrl(slug: string): string {
    return `${this.BASE_URL}${this.LOCALE}/collections/${slug}`;
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
      const product = await this.productRepo.findOne({ 
        where: { source_id: sourceId },
        relations: ['detail', 'reviews', 'category'],
      });

      if (!product) {
        this.logger.warn(`Product not found: ${sourceId}`);
        return null;
      }

      if (forceRefresh || !product.detail) {
        await this.scrapingQueue.add('scrape-product-detail', {
          productId: product.id,
          url: product.source_url,
          sourceId: product.source_id,
        });
      }

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
      // Get IDs of the 8 CORRECT navigation items
      const correctNavigation = await this.navigationRepo.find({
        where: [
          { title: 'Clearance' },
          { title: 'eGift Cards' },
          { title: 'Fiction Books' },
          { title: 'Non-Fiction Books' },
          { title: 'Children\'s Books' },
          { title: 'Rare Books' },
          { title: 'Music & Film' },
          { title: 'Sell Your Books' }
        ]
      });

      const correctIds = correctNavigation.map(nav => nav.id);
      
      if (correctIds.length === 0) {
        return { deleted: 0, message: 'No correct navigation items found' };
      }

      let totalDeleted = 0;
      const messages: string[] = [];

      // Use TypeORM queries instead of raw SQL to avoid table name issues
      // Delete products linked to wrong categories
      const wrongProducts = await this.productRepo.find({
        relations: ['category', 'category.navigation'],
        where: [
          { category: { navigation: { id: Not(In(correctIds)) } } },
          { category: null } // Also delete orphaned products
        ]
      });

      if (wrongProducts.length > 0) {
        await this.productRepo.remove(wrongProducts);
        totalDeleted += wrongProducts.length;
        messages.push(`${wrongProducts.length} products`);
      }

      // Delete categories linked to wrong navigation
      const wrongCategories = await this.categoryRepo.find({
        relations: ['navigation'],
        where: [
          { navigation: { id: Not(In(correctIds)) } },
          { navigation: null } // Also delete orphaned categories
        ]
      });

      if (wrongCategories.length > 0) {
        await this.categoryRepo.remove(wrongCategories);
        totalDeleted += wrongCategories.length;
        messages.push(`${wrongCategories.length} categories`);
      }

      // Delete wrong navigation items
      const wrongNavigation = await this.navigationRepo.find({
        where: { id: Not(In(correctIds)) }
      });

      if (wrongNavigation.length > 0) {
        await this.navigationRepo.remove(wrongNavigation);
        totalDeleted += wrongNavigation.length;
        messages.push(`${wrongNavigation.length} navigation`);
      }

      const message = totalDeleted > 0 
        ? `Cleaned up ${totalDeleted} items (${messages.join(', ')})`
        : 'No items to clean up';
      
      this.logger.log(`Cleanup: ${message}`);
      
      return {
        deleted: totalDeleted,
        message
      };
    } catch (error: any) {
      this.logger.error(`Cleanup failed: ${error.message}`);
      return {
        deleted: 0,
        message: `Cleanup failed: ${error.message}`
      };
    }
  }

  async clearCache(): Promise<{ success: boolean; message: string }> {
    try {
      const cache = this.cacheManager as any;
      
      if (cache.store?.reset) {
        await cache.store.reset();
      } else if (cache.store?.flushAll) {
        await cache.store.flushAll();
      } else if (cache.store?.clear) {
        await cache.store.clear();
      } else {
        const knownKeys = ['navigation_data'];
        for (const key of knownKeys) {
          await this.cacheManager.del(key);
        }
        
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