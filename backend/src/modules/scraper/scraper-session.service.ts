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
  /** Last page of the collection feed served to this client, for "load more". */
  lastPage: number;
}

@Injectable()
export class ScraperSessionService implements OnModuleDestroy {
  private readonly logger = new Logger(ScraperSessionService.name);
  private readonly activeSessions = new Map<string, ActiveSession>();
  /** In-flight session creations, so parallel events share one browser launch. */
  private readonly pendingSessions = new Map<string, Promise<ActiveSession>>();
  private readonly sessionTimeout = 30 * 60 * 1000; // 30 minutes
  /** How many times to reopen the homepage and try the menu click before giving up. */
  private readonly CLICK_ATTEMPTS = 3;
  private readonly PAGE_SIZE = 40;

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

  /**
   * Return this client's browser session, starting one if needed.
   *
   * Sessions are created on first use rather than on connect: a browser launch that failed
   * at connect time used to leave the client permanently without a session (every later
   * click silently fell back to stored data), and idle visitors launched a browser they
   * never used. Concurrent callers share one launch.
   */
  async ensureSession(sessionId: string): Promise<ActiveSession> {
    const existing = this.activeSessions.get(sessionId);
    if (existing) {
      if (existing.browser.isConnected()) return existing;

      // Browser died under us (crash, or closed by the OS) — drop it and start over.
      this.logger.warn(`Session ${sessionId} lost its browser; recreating`);
      this.activeSessions.delete(sessionId);
    }

    let pending = this.pendingSessions.get(sessionId);
    if (!pending) {
      pending = this.createSession(sessionId)
        .then(() => this.activeSessions.get(sessionId)!)
        .finally(() => this.pendingSessions.delete(sessionId));
      this.pendingSessions.set(sessionId, pending);
    }

    return pending;
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
        lastPage: 0,
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
    
    const session = await this.ensureSession(sessionId);
    
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
    
    const session = await this.ensureSession(sessionId);
    
    try {
      // A click is an explicit request for live data: mirror it on the real site and only
      // fall back to what is stored once the live attempts are exhausted.
      const clicked = await this.clickWithRetries(session, categorySlug, navigationSlug || target);

      if (!clicked) {
        return this.cachedFallback(
          categorySlug,
          `Could not click "${categorySlug}" in the menu after ${this.CLICK_ATTEMPTS} attempts`,
        );
      }

      // Scrape first batch
      const products = await this.interactiveScraper.scrapeProductsFromPage(
        session.page,
        categorySlug,
        this.PAGE_SIZE,
        1,
      );

      // Update session state
      session.categorySlug = categorySlug;
      session.productsScraped = products.length;
      session.lastPage = 1;
      session.currentUrl = session.page.url();

      if (products.length === 0) {
        return this.cachedFallback(categorySlug, `No products found live on ${categorySlug}`);
      }

      await this.saveProductsToCache(categorySlug, products);

      // Queue background refresh for other categories
      await this.queueBackgroundRefresh(categorySlug);

      const hasMore = await this.interactiveScraper.hasMorePages(session.page, categorySlug, 2);

      return {
        products,
        status: 'success',
        message: `Scraped ${products.length} products live from ${categorySlug}`,
        totalScraped: products.length,
        hasMore,
      };

    } catch (error) {
      this.logger.error(`Click failed for ${sessionId}:`, error);
      return this.cachedFallback(categorySlug, `Live scrape failed: ${error.message}`);
    }
  }

  async handleLoadMore(sessionId: string, target: string, categorySlug: string): Promise<ScrapingResult> {
    this.updateActivity(sessionId);
    
    const session = await this.ensureSession(sessionId);
    
    try {
      // A category switch can leave the session pointing elsewhere; restart paging then.
      if (session.categorySlug !== categorySlug) {
        session.categorySlug = categorySlug;
        session.lastPage = 1;
        session.productsScraped = 0;
      }

      const nextPage = (session.lastPage || 1) + 1;

      const newProducts = await this.interactiveScraper.scrapeProductsFromPage(
        session.page,
        categorySlug,
        this.PAGE_SIZE,
        nextPage,
      );

      if (newProducts.length === 0) {
        return {
          products: [],
          status: 'partial',
          message: 'No more products to load',
          totalScraped: session.productsScraped,
          hasMore: false,
        };
      }

      // Update counts
      session.lastPage = nextPage;
      session.productsScraped += newProducts.length;

      await this.saveProductsToCache(categorySlug, newProducts);

      // Check if still more available
      const hasMore = await this.interactiveScraper.hasMorePages(
        session.page,
        categorySlug,
        nextPage + 1,
      );

      // Update session stats
      await this.updateSessionStats(sessionId, {
        load_more_count: nextPage - 1,
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
    const session = await this.ensureSession(sessionId);
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

  /**
   * Hover the section and click the category, reopening the homepage between attempts.
   *
   * The menu is injected progressively and its links only become clickable once their panel
   * is hovered, so a failure is usually a timing problem that a fresh page load resolves —
   * worth retrying before falling back to stored data.
   */
  private async clickWithRetries(
    session: ActiveSession,
    categorySlug: string,
    navigationSlug?: string,
  ): Promise<boolean> {
    for (let attempt = 1; attempt <= this.CLICK_ATTEMPTS; attempt++) {
      try {
        // Always start from the homepage: after a previous click the browser sits on a
        // collection page, where the menu markup may differ or be stale.
        await this.interactiveScraper.navigateToHomepage(session.page);

        if (navigationSlug) {
          await this.interactiveScraper.hoverNavigation(session.page, navigationSlug);
        }

        if (await this.interactiveScraper.clickCategory(session.page, categorySlug, navigationSlug)) {
          this.logger.log(`Clicked ${categorySlug} on attempt ${attempt}/${this.CLICK_ATTEMPTS}`);
          return true;
        }

        this.logger.warn(`Click attempt ${attempt}/${this.CLICK_ATTEMPTS} failed for ${categorySlug}`);
      } catch (error) {
        this.logger.warn(
          `Click attempt ${attempt}/${this.CLICK_ATTEMPTS} for ${categorySlug} threw: ${error.message}`,
        );
      }
    }

    return false;
  }

  /**
   * Last resort when a live pass yields nothing: serve what was stored previously so the
   * grid is not empty, while saying plainly that the data is not fresh.
   */
  private async cachedFallback(categorySlug: string, reason: string): Promise<ScrapingResult> {
    const cachedProducts = await this.getCachedProducts(categorySlug, 120);

    this.logger.warn(`${reason} — falling back to ${cachedProducts.length} stored products`);

    return {
      products: cachedProducts,
      status: cachedProducts.length > 0 ? 'partial' : 'failed',
      message: cachedProducts.length > 0
        ? `${reason}. Showing ${cachedProducts.length} previously scraped products`
        : reason,
      totalScraped: cachedProducts.length,
      hasMore: false,
    };
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
        existing.author = productData.author ?? existing.author;
        existing.price = productData.price;
        existing.image_url = productData.image_url;
        existing.last_scraped_at = new Date();
        await this.productRepo.save(existing);
      } else {
        // Create
        const product = this.productRepo.create({
          source_id: productData.source_id,
          title: productData.title,
          author: productData.author ?? null,
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

  private async updateProductWithDetails(sourceId: string, _details: any): Promise<void> {
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