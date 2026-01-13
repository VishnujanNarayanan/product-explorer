// backend/src/modules/scraper/scraper-session.service.ts (COMPLETE VERSION)
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as playwright from 'playwright';

import { ScraperSession } from '../../entities/scraper-session.entity';
import { Product } from '../../entities/product.entity';
import { Category } from '../../entities/category.entity';
import { Navigation } from '../../entities/navigation.entity';
import { InteractiveScraper } from './scrapers/interactive.scraper';

export interface ScrapingResult {
  products: any[];
  status: 'success' | 'partial' | 'failed';
  message: string;
  totalScraped: number;
  hasMore: boolean;
}

interface ActiveSession {
  browser: playwright.Browser;
  context: playwright.BrowserContext;
  page: playwright.Page;
  lastActivity: Date;
  currentUrl: string;
  categorySlug?: string;
  productsScraped: number;
}

@Injectable()
export class ScraperSessionService implements OnModuleDestroy {
  private readonly logger = new Logger(ScraperSessionService.name);
  private readonly activeSessions = new Map<string, ActiveSession>();
  private readonly sessionTimeout = 30 * 60 * 1000; // 30 minutes

  constructor(
    @InjectRepository(ScraperSession)
    private readonly sessionRepo: Repository<ScraperSession>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Navigation)
    private readonly navigationRepo: Repository<Navigation>,
    private readonly interactiveScraper: InteractiveScraper,
    @InjectQueue('background-scraping')
    private readonly backgroundQueue: Queue,
  ) {
    // Start cleanup interval
    setInterval(() => this.cleanupInactiveSessions(), 5 * 60 * 1000);
  }

  async createSession(sessionId: string): Promise<void> {
    this.logger.log(`Creating interactive scraper session: ${sessionId}`);
    
    try {
      const { browser, context, page } = await this.interactiveScraper.initializeBrowser();
      await this.interactiveScraper.navigateToHomepage(page);
      
      const session: ActiveSession = {
        browser,
        context,
        page,
        lastActivity: new Date(),
        currentUrl: page.url(),
        productsScraped: 0,
      };
      
      this.activeSessions.set(sessionId, session);
      
      // Save to database
      await this.sessionRepo.save({
        session_id: sessionId,
        current_url: session.currentUrl,
        status: 'active',
        stats: {
          total_products_scraped: 0,
          load_more_count: 0,
        },
      });
      
      this.logger.log(`Session ${sessionId} created successfully`);
      
    } catch (error) {
      this.logger.error(`Failed to create session ${sessionId}:`, error);
      throw new Error(`Failed to initialize interactive scraper: ${error.message}`);
    }
  }

  async handleHover(sessionId: string, target: string, navigationSlug?: string): Promise<ScrapingResult> {
    this.updateActivity(sessionId);
    
    const session = this.getSession(sessionId);
    
    try {
      const hovered = await this.interactiveScraper.hoverNavigation(
        session.page,
        target,
        navigationSlug
      );
      
      return {
        products: [],
        status: hovered ? 'success' : 'partial',
        message: hovered ? `Hovered over ${target}` : `Could not hover over ${target}`,
        totalScraped: 0,
        hasMore: false,
      };
      
    } catch (error) {
      this.logger.error(`Hover failed for ${sessionId}:`, error);
      return {
        products: [],
        status: 'failed',
        message: `Hover failed: ${error.message}`,
        totalScraped: 0,
        hasMore: false,
      };
    }
  }

  async handleClick(sessionId: string, target: string, categorySlug: string, navigationSlug?: string): Promise<ScrapingResult> {
    this.updateActivity(sessionId);
    
    const session = this.getSession(sessionId);
    
    try {
      // First check cache
      const cachedProducts = await this.getCachedProducts(categorySlug, 120);
      if (cachedProducts.length > 0) {
        this.logger.log(`Returning ${cachedProducts.length} cached products for ${categorySlug}`);
        
        return {
          products: cachedProducts,
          status: 'success',
          message: `Loaded ${cachedProducts.length} cached products`,
          totalScraped: cachedProducts.length,
          hasMore: cachedProducts.length >= 120,
        };
      }
      
      // Hover navigation if provided
      if (navigationSlug) {
        await this.interactiveScraper.hoverNavigation(session.page, navigationSlug);
      }
      
      // Click category
      const clicked = await this.interactiveScraper.clickCategory(
        session.page,
        target,
        categorySlug
      );
      
      if (!clicked) {
        throw new Error(`Failed to click category ${categorySlug}`);
      }
      
      // Scrape first batch
      const products = await this.interactiveScraper.scrapeProductsFromPage(
        session.page,
        categorySlug,
        40
      );
      
      // Update session state
      session.categorySlug = categorySlug;
      session.productsScraped = products.length;
      session.currentUrl = session.page.url();
      
      // Save to cache
      if (products.length > 0) {
        await this.saveProductsToCache(categorySlug, products);
        
        // Queue background refresh for other categories
        await this.queueBackgroundRefresh(categorySlug);
      }
      
      // Check if more products available
      const hasMore = await this.interactiveScraper.clickLoadMore(session.page);
      
      return {
        products,
        status: 'success',
        message: `Scraped ${products.length} products from ${categorySlug}`,
        totalScraped: products.length,
        hasMore,
      };
      
    } catch (error) {
      this.logger.error(`Click failed for ${sessionId}:`, error);
      return {
        products: [],
        status: 'failed',
        message: `Click failed: ${error.message}`,
        totalScraped: 0,
        hasMore: false,
      };
    }
  }

  async handleLoadMore(sessionId: string, target: string, categorySlug: string): Promise<ScrapingResult> {
    this.updateActivity(sessionId);
    
    const session = this.getSession(sessionId);
    
    try {
      // Click load more
      const clicked = await this.interactiveScraper.clickLoadMore(session.page);
      
      if (!clicked) {
        return {
          products: [],
          status: 'partial',
          message: 'No more products to load',
          totalScraped: session.productsScraped,
          hasMore: false,
        };
      }
      
      // Scrape new products
      const newProducts = await this.interactiveScraper.scrapeProductsFromPage(
        session.page,
        categorySlug,
        40
      );
      
      // Update counts
      session.productsScraped += newProducts.length;
      
      // Save to cache
      if (newProducts.length > 0) {
        await this.saveProductsToCache(categorySlug, newProducts);
      }
      
      // Check if still more available
      const hasMore = await this.interactiveScraper.clickLoadMore(session.page);
      
      // Update session stats
      await this.updateSessionStats(sessionId, {
        load_more_count: (session.productsScraped / 40) - 1,
        total_products_scraped: session.productsScraped,
      });
      
      return {
        products: newProducts,
        status: 'success',
        message: `Loaded ${newProducts.length} more products`,
        totalScraped: session.productsScraped,
        hasMore,
      };
      
    } catch (error) {
      this.logger.error(`Load more failed for ${sessionId}:`, error);
      return {
        products: [],
        status: 'failed',
        message: `Load more failed: ${error.message}`,
        totalScraped: session.productsScraped,
        hasMore: false,
      };
    }
  }

  async getProductDetails(sessionId: string, sourceId: string): Promise<any> {
    this.updateActivity(sessionId);
    
    // Check cache first
    const cachedProduct = await this.productRepo.findOne({
      where: { source_id: sourceId },
      relations: ['detail', 'reviews', 'category'],
    });
    
    if (cachedProduct?.detail) {
      return cachedProduct;
    }
    
    // Get from session
    const session = this.getSession(sessionId);
    const product = await this.productRepo.findOne({
      where: { source_id: sourceId },
    });
    
    if (!product) {
      throw new Error(`Product ${sourceId} not found`);
    }
    
    // Navigate and scrape details
    const details = await this.interactiveScraper.getProductDetails(
      session.page,
      product.source_url
    );
    
    // Update product in database
    await this.updateProductWithDetails(sourceId, details);
    
    // Get updated product
    return await this.productRepo.findOne({
      where: { source_id: sourceId },
      relations: ['detail', 'reviews', 'category'],
    });
  }

  private getSession(sessionId: string): ActiveSession {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found or expired`);
    }
    return session;
  }

  private async getCachedProducts(categorySlug: string, limit: number): Promise<any[]> {
    const category = await this.categoryRepo.findOne({
      where: { slug: categorySlug },
    });
    
    if (!category) {
      return [];
    }
    
    const products = await this.productRepo.find({
      where: { category: { id: category.id } },
      relations: ['category'],
      order: { last_scraped_at: 'DESC' },
      take: limit,
    });
    
    return products;
  }

  private async saveProductsToCache(categorySlug: string, products: any[]): Promise<void> {
    const category = await this.categoryRepo.findOne({
      where: { slug: categorySlug },
    });
    
    if (!category) {
      this.logger.warn(`Category ${categorySlug} not found for caching`);
      return;
    }
    
    for (const productData of products) {
      const existing = await this.productRepo.findOne({
        where: { source_id: productData.source_id },
      });
      
      if (existing) {
        // Update
        existing.title = productData.title;
        existing.price = productData.price;
        existing.image_url = productData.image_url;
        existing.last_scraped_at = new Date();
        await this.productRepo.save(existing);
      } else {
        // Create
        const product = this.productRepo.create({
          source_id: productData.source_id,
          title: productData.title,
          price: productData.price,
          currency: productData.currency || 'GBP',
          image_url: productData.image_url || '',
          source_url: productData.source_url,
          category,
          last_scraped_at: new Date(),
        });
        await this.productRepo.save(product);
      }
    }
    
    // Update category count
    category.product_count = await this.productRepo.count({
      where: { category: { id: category.id } },
    });
    category.last_scraped_at = new Date();
    await this.categoryRepo.save(category);
    
    this.logger.log(`Cached ${products.length} products for ${categorySlug}`);
  }

  private async queueBackgroundRefresh(currentCategorySlug: string): Promise<void> {
    // Get all other categories
    const allCategories = await this.categoryRepo.find({
      where: { slug: Not(currentCategorySlug) },
      take: 10,
    });
    
    for (const category of allCategories) {
      await this.backgroundQueue.add('refresh-stale', {
        type: 'refresh-stale',
        target: category.slug,
        priority: 'low',
        triggeredBy: 'user-interaction',
      });
    }
  }

  private async updateProductWithDetails(sourceId: string, details: any): Promise<void> {
    // Implementation depends on your product detail structure
    this.logger.log(`Updating details for product ${sourceId}`);
  }

  private async updateSessionStats(sessionId: string, stats: any): Promise<void> {
    await this.sessionRepo.update(
      { session_id: sessionId },
      { stats, last_active: new Date() }
    );
  }

  private updateActivity(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  async cleanupSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      try {
        await session.page.close();
        await session.context.close();
        await session.browser.close();
        
        this.activeSessions.delete(sessionId);
        
        // Update database
        await this.sessionRepo.update(
          { session_id: sessionId },
          { status: 'terminated', last_active: new Date() }
        );
        
        this.logger.log(`Cleaned up session ${sessionId}`);
      } catch (error) {
        this.logger.error(`Failed to cleanup session ${sessionId}:`, error);
      }
    }
  }

  private async cleanupInactiveSessions(): Promise<void> {
    const now = new Date();
    
    for (const [sessionId, session] of this.activeSessions.entries()) {
      const inactiveTime = now.getTime() - session.lastActivity.getTime();
      
      if (inactiveTime > this.sessionTimeout) {
        this.logger.log(`Cleaning up inactive session ${sessionId} (${Math.round(inactiveTime/60000)}m inactive)`);
        await this.cleanupSession(sessionId);
      }
    }
  }

  async onModuleDestroy() {
    const cleanupPromises = Array.from(this.activeSessions.keys()).map(
      sessionId => this.cleanupSession(sessionId)
    );
    await Promise.allSettled(cleanupPromises);
  }
}