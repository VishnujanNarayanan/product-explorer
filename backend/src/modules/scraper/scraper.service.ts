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
import { CategoryScraper, CategoryScrapeResult } from './scrapers/category.scraper';
import { ProductScraper } from './scrapers/product.scraper';
import { ProductDetailScraper } from './scrapers/product-detail.scraper';

import { Navigation } from '../../entities/navigation.entity';
import { Category } from '../../entities/category.entity';
import { Product } from '../../entities/product.entity';
import { ProductDetail } from '../../entities/product-detail.entity';
import { Review } from '../../entities/review.entity';
import { ScrapeJob } from '../../entities/scrape-job.entity';
import { findCategory } from '../../common/category-lookup';

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

  /**
   * Redis holds a cache and a job queue — two optimisations. Neither is allowed to fail a
   * request that Postgres can answer on its own, which is every read below: the products are
   * already stored, and the cache only saves a query.
   *
   * The timeout matters as much as the catch. A Redis client keeps an offline queue by
   * default, accepting commands while disconnected and resolving them if it ever reconnects,
   * so awaiting one during an outage is unbounded — a browse of stored data hung for 90
   * seconds and then 500'd, which is how this was found.
   */
  private static readonly REDIS_TIMEOUT_MS = 2000;

  /**
   * Budget for a listing scrape performed inside a request. The scraper reads Shopify's
   * products.json over HTTP, which takes a second or two plus the politeness delay, and the
   * browser client gives up at 30s — so this leaves room to return stored data either way.
   */
  private static readonly INLINE_SCRAPE_TIMEOUT_MS = 20000;

  /** Rejects if `work` has not settled in time, without leaving a timer behind. */
  private static async withTimeout<T>(ms: number, work: () => Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        work(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Health is tracked per client, not per Redis. The cache and the queue hold separate
   * connections that can fail independently — and did: over a TLS endpoint the cache stayed up
   * while the queue could not complete a handshake. A single shared flag made the two clients
   * take turns announcing an outage and a recovery that neither had had.
   *
   * Logged on transition rather than per request, or an outage floods the log.
   */
  private readonly degraded: Record<'cache' | 'queue', boolean> = {
    cache: false,
    queue: false,
  };

  private static readonly CONSEQUENCE: Record<'cache' | 'queue', string> = {
    cache: 'serving from Postgres until it recovers',
    queue: 'background scrapes are not being queued until it recovers',
  };

  private async bounded<T>(
    client: 'cache' | 'queue',
    operation: string,
    work: () => Promise<T>,
  ): Promise<T | undefined> {
    try {
      const result = await ScraperService.withTimeout(ScraperService.REDIS_TIMEOUT_MS, work);

      if (this.degraded[client]) {
        this.degraded[client] = false;
        this.logger.log(`Redis ${client} is reachable again`);
      }
      return result;
    } catch (error) {
      if (!this.degraded[client]) {
        this.degraded[client] = true;
        this.logger.warn(
          `Redis ${client} unavailable (${operation}: ${error.message}) — ` +
            ScraperService.CONSEQUENCE[client],
        );
      }
      return undefined;
    }
  }

  private cacheGet<T>(key: string): Promise<T | undefined> {
    return this.bounded('cache', `get ${key}`, () => this.cacheManager.get<T>(key));
  }

  private async cacheSet(key: string, value: unknown, ttlMs: number): Promise<void> {
    await this.bounded('cache', `set ${key}`, () => this.cacheManager.set(key, value, ttlMs));
  }

  private async cacheDel(key: string): Promise<void> {
    await this.bounded('cache', `del ${key}`, () => this.cacheManager.del(key));
  }

  /** Whether the job actually reached the queue, so a caller can report what it really did. */
  private async enqueue(name: string, payload: Record<string, unknown>): Promise<boolean> {
    const job = await this.bounded('queue', `enqueue ${name}`, () =>
      this.scrapingQueue.add(name, payload),
    );
    return job !== undefined;
  }

  /**
   * Fill the navigation tree on first boot, so a fresh install is not empty.
   *
   * Deliberately best-effort. This used to `await` the scrape unguarded, which meant a failure
   * to launch Chromium — a missing browser, a blocked network, markup drift — aborted module
   * initialisation and the whole API refused to start, including the endpoints that never
   * scrape anything. Serving stored or seeded data is strictly better than serving nothing.
   *
   * Set `SCRAPE_ON_STARTUP=false` to skip it entirely: useful in tests and CI, and for any
   * deployment that prefers to populate the database with `npm run seed`.
   */
  async onModuleInit() {
    if (process.env.SCRAPE_ON_STARTUP === 'false') {
      this.logger.log('Startup navigation scrape disabled by SCRAPE_ON_STARTUP=false');
      return;
    }

    try {
      const count = await this.navigationRepo.count();
      if (count === 0) {
        this.logger.log('Navigation table is empty — scraping it once on startup');
        await this.scrapeAndSaveNavigation();
      }
    } catch (error) {
      this.logger.error(
        `Startup navigation scrape failed, continuing without it: ${error.message}. ` +
          'Populate the database with `npm run seed` or POST /api/scrape/navigation.',
      );
    }
  }

  async scrapeAndSaveNavigation(): Promise<Navigation[]> {
    const cacheKey = 'navigation_data';
    const cached = await this.cacheGet<Navigation[]>(cacheKey);

    if (cached) {
      this.logger.log('Returning cached navigation data');
      return cached;
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

        // Scoped to the heading: the same collection under a different heading is a
        // separate row, so matching on the slug alone would keep overwriting one row.
        if (!parentNav) continue;

        const existingCategory = await this.categoryRepo.findOne({
          where: { slug: categoryItem.slug, navigation: { id: parentNav.id } },
        });

        if (existingCategory) {
          existingCategory.title = categoryItem.title;
          existingCategory.last_scraped_at = new Date();
          await this.categoryRepo.save(existingCategory);
        } else {
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
        await this.cacheSet(cacheKey, savedNavigation, 24 * 60 * 60 * 1000);
      } else {
        this.logger.warn('Navigation scrape returned no items — not caching');
      }

      this.logger.log(`Navigation scraping completed: ${savedNavigation.length} nav items, ${categories.length} categories saved`);
      return savedNavigation;
    } catch (error) {
      this.logger.error(`Navigation scraping failed: ${error.message}`);
      // Drop any stale entry so the next call retries instead of serving a bad cache hit.
      await this.cacheDel(cacheKey);
      throw error;
    }
  }

  async scrapeCategoryBySlug(
    slug: string,
    options: { page?: number; limit?: number; navigationSlug?: string } = {},
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
    // would serve page 1's rows for every subsequent page. The heading belongs in the key
    // too — the same slug under two headings is two categories with two product lists.
    const navigationSlug = options.navigationSlug;
    const cacheKey = `category_${navigationSlug ?? '_'}_${slug}_p${page}_l${limit}`;
    const cached = await this.cacheGet<{
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

    const category = await findCategory(this.categoryRepo, slug, navigationSlug, ['navigation']);

    if (!category) {
      // A missing category is a client error, not a server fault.
      throw new NotFoundException(
        navigationSlug
          ? `Category not found: ${slug} under ${navigationSlug}`
          : `Category not found: ${slug}`,
      );
    }

    // Queue another page only while the collection still has one. Fully-scraped categories
    // are served from the DB, so browsing them costs World of Books nothing.
    // Reports what actually happened rather than what was intended: with the queue
    // unreachable, claiming a job was queued would promise the client an update that is
    // never coming.
    const jobQueued = category.is_exhausted
      ? false
      : await this.enqueue('scrape-category', {
          categorySlug: slug,
          categoryId: category.id,
          navigationSlug: category.navigation?.slug || null,
          url: this.collectionUrl(slug),
        });

    const read = () =>
      this.productRepo.findAndCount({
        where: { category: { id: category.id } },
        relations: ['category'],
        order: { id: 'ASC' },
        skip: (page - 1) * limit,
        take: limit,
      });

    let [products, total] = await read();

    // A category nobody has opened yet holds nothing, and the queue that would fill it may not
    // be running — or may not be reachable at all. Rather than hand back an empty grid and let
    // the client conclude the collection is empty, fetch it now: this is one HTTP request to a
    // JSON feed, so it is affordable to do while someone waits.
    let scrapedNow = false;
    if (total === 0 && !category.is_exhausted) {
      this.logger.log(`No stored products for ${slug} — scraping it inline`);
      scrapedNow = (await this.scrapeCategoryPageNow(category)) !== null;
      if (scrapedNow) {
        [products, total] = await read();
      }
    }

    if (products.length > 0) {
      await this.cacheSet(cacheKey, { products, category, total }, 60 * 60 * 1000);
    }

    return {
      message: this.categoryMessage(slug, products.length, {
        jobQueued,
        scrapedNow,
        exhausted: category.is_exhausted,
      }),
      products,
      category,
      jobQueued,
      total,
      page,
      limit,
      hasMore: page * limit < total,
    };
  }

  /**
   * Says what actually happened. "Fully scraped" used to be the message for anything that did
   * not queue a job, so once `jobQueued` came to mean "the queue accepted it" rather than "the
   * collection has more pages", an unreachable queue reported categories as complete that were
   * nowhere near it — the response claimed `fully scraped` beside `is_exhausted: false`.
   */
  private categoryMessage(
    slug: string,
    returned: number,
    state: { jobQueued: boolean; scrapedNow: boolean; exhausted: boolean },
  ): string {
    if (state.scrapedNow) {
      return `Scraped ${slug} live from World of Books. Returning ${returned} products.`;
    }
    if (state.jobQueued) {
      return `Scraping job queued for category: ${slug}. Returning ${returned} existing products.`;
    }
    if (state.exhausted) {
      return `Category ${slug} fully scraped. Returning ${returned} products.`;
    }
    return `Returning ${returned} stored products for ${slug}.`;
  }

  private collectionUrl(slug: string): string {
    return `${this.BASE_URL}${this.LOCALE}/collections/${slug}`;
  }

  /**
   * Scrape the next unread page of a collection and store it, in the request rather than on the
   * queue.
   *
   * Affordable because the listing scraper reads Shopify's products.json over HTTP and never
   * launches a browser — one outbound request, and it runs anywhere, including an instance too
   * small to start Chromium. That is what lets a visitor open a category nobody has opened
   * before and see real books, with no queue to carry the work and no worker to be running.
   *
   * Returns how many products are now stored for the category, or null if the scrape failed.
   */
  async scrapeCategoryPageNow(category: Category, maxPages = 1): Promise<number | null> {
    const startPage = (category.last_page_scraped || 0) + 1;

    try {
      const result = await ScraperService.withTimeout(
        ScraperService.INLINE_SCRAPE_TIMEOUT_MS,
        () => this.categoryScraper.scrape(category.slug, { startPage, maxPages }),
      );

      return await this.storeCategoryScrape(category, result, startPage);
    } catch (error) {
      // A live scrape is a bonus on top of stored data, so its failure must not fail the read
      // that asked for it. The caller returns whatever the database already had.
      this.logger.warn(`Inline scrape of ${category.slug} failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Persists a listing scrape and advances the category's checkpoint. Shared with the queue
   * processor so a scrape is stored identically whether it ran in a request or on the queue.
   *
   * Returns the category's resulting product count.
   */
  async storeCategoryScrape(
    category: Category,
    result: CategoryScrapeResult,
    startPage: number,
  ): Promise<number> {
    for (const productData of result.products) {
      try {
        // Scoped to this category. source_id is unique per category, not globally, so a
        // collection listed under two headings fills both instead of the second scrape moving
        // every row off the first.
        const existing = await this.productRepo.findOne({
          where: { source_id: productData.source_id, category: { id: category.id } },
        });

        if (existing) {
          existing.title = productData.title;
          existing.author = productData.author;
          existing.price = productData.price;
          existing.currency = productData.currency;
          existing.image_url = productData.image_url;
          existing.last_scraped_at = new Date();
          await this.productRepo.save(existing);
        } else {
          await this.productRepo.save(
            this.productRepo.create({
              source_id: productData.source_id,
              title: productData.title,
              author: productData.author,
              price: productData.price,
              currency: productData.currency,
              image_url: productData.image_url,
              source_url: productData.source_url,
              category,
              last_scraped_at: new Date(),
            }),
          );
        }
      } catch (error) {
        // One malformed row should not lose the rest of the page.
        this.logger.warn(`Failed to save product ${productData.source_id}: ${error.message}`);
      }
    }

    // Advanced only after the products are persisted, so an interrupted run re-fetches the page
    // instead of skipping it.
    category.last_page_scraped = result.nextPage
      ? result.nextPage - 1
      : startPage + result.pagesFetched - 1;
    category.is_exhausted = result.exhausted;
    category.product_count = await this.productRepo.count({
      where: { category: { id: category.id } },
    });
    category.last_scraped_at = new Date();
    await this.categoryRepo.save(category);

    this.logger.log(
      `Stored ${result.products.length} products for ${category.slug} ` +
        `(pages ${startPage}..${startPage + result.pagesFetched - 1}` +
        `${result.exhausted ? ', collection exhausted' : `, next page ${result.nextPage}`})`,
    );

    return category.product_count;
  }

  async scrapeProductBySourceId(sourceId: string, forceRefresh = false): Promise<Product | null> {
    const cacheKey = `product_${sourceId}`;
    
    if (!forceRefresh) {
      const cached = await this.cacheGet<Product>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      // A product can now exist once per category, but its detail page is the same page
      // whichever category it was reached through. Resolve to the oldest row so detail is
      // scraped and stored once rather than per copy.
      const product = await this.productRepo.findOne({
        where: { source_id: sourceId },
        relations: ['detail', 'reviews', 'category'],
        order: { id: 'ASC' },
      });

      if (!product) {
        this.logger.warn(`Product not found: ${sourceId}`);
        return null;
      }

      if (forceRefresh || !product.detail) {
        await this.enqueue('scrape-product-detail', {
          productId: product.id,
          url: product.source_url,
          sourceId: product.source_id,
        });
      }

      await this.cacheSet(cacheKey, product, 24 * 60 * 60 * 1000);
      
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
        // Each branch is braced: a bare `const` in a case body is scoped to the whole switch,
        // so it stays in the temporal dead zone for the other branches.
        case 'navigation': {
          const url = target || this.BASE_URL;
          await this.scrapingQueue.add('scrape-navigation', {
            jobId: job.id,
            url
          });
          break;
        }

        case 'category': {
          // No heading to scope by on this legacy route, so the oldest matching row wins.
          const category = await findCategory(this.categoryRepo, target);

          if (!category) {
            throw new NotFoundException(`Category not found: ${target}`);
          }

          await this.scrapingQueue.add('scrape-category', {
            categorySlug: target,
            categoryId: category.id,
            url: `${this.BASE_URL}/collections/${target}`,
            jobId: job.id
          });
          break;
        }

        case 'product': {
          const product = await this.productRepo.findOne({
            where: { source_id: target }
          });

          if (!product) {
            throw new NotFoundException(`Product not found: ${target}`);
          }

          await this.scrapingQueue.add('scrape-product-detail', {
            sourceId: target,
            productId: product.id,
            url: product.source_url,
            jobId: job.id
          });
          break;
        }
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