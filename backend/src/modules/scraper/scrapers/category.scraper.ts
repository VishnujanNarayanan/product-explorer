import { Injectable } from '@nestjs/common';
import { CheerioCrawler, HttpCrawler, RequestQueue } from 'crawlee';
import { BaseScraper } from './base.scraper';

export interface ProductPreview {
  source_id: string;
  title: string;
  author: string | null;
  price: number;
  currency: string;
  image_url: string;
  source_url: string;
  category_slug: string;
  description: string;
}

export interface CategoryScrapeResult {
  products: ProductPreview[];
  pagesFetched: number;
  /** Next page to request on a later run, or null when the collection is exhausted. */
  nextPage: number | null;
  exhausted: boolean;
}

export interface CategoryScrapeOptions {
  /** 1-based page to resume from (the stored checkpoint). */
  startPage?: number;
  /** How many pages to pull in this run — keeps first-load latency bounded. */
  maxPages?: number;
  pageSize?: number;
}

/**
 * Scrapes product listings for a collection.
 *
 * The category page itself renders its grid through Algolia InstantSearch on the client. In a
 * headless browser the grid never resolves past `#skeleton-loader` (Algolia reports
 * "Unreachable hosts"), so DOM scraping of the PLP cannot work reliably. Shopify exposes the
 * same catalogue as structured JSON at `/collections/<slug>/products.json`, which robots.txt
 * permits, so we read that instead — through Crawlee's HttpCrawler to keep the queueing,
 * retry and backoff behaviour consistent with the rest of the pipeline.
 */
@Injectable()
export class CategoryScraper extends BaseScraper {
  private readonly DEFAULT_PAGE_SIZE = 250;
  private readonly DEFAULT_MAX_PAGES = 1;
  /** Upper bound on collections aggregated for one landing page. */
  private readonly MAX_HUB_COLLECTIONS = 6;

  /** Landing page slug -> collections it links to. */
  private readonly hubCollections = new Map<string, string[]>();

  async scrape(categorySlug: string, options: CategoryScrapeOptions = {}): Promise<CategoryScrapeResult> {
    const pageSize = options.pageSize ?? this.DEFAULT_PAGE_SIZE;
    const maxPages = Math.max(1, options.maxPages ?? this.DEFAULT_MAX_PAGES);
    const startPage = Math.max(1, options.startPage ?? 1);

    // Usually just the category itself. Menu entries pointing at /pages/ landing pages have
    // no feed of their own, so they resolve to the collections the page links to.
    const targets = await this.resolveTargets(categorySlug);

    const byPage = new Map<string, ProductPreview[]>();
    const shortPages: number[] = [];
    let scrapeError: Error | null = null;

    // Isolated queue per run. Crawlee reuses and persists its default request queue across
    // crawler instances, so re-requesting a page would be treated as already handled and the
    // handler would never fire — silently breaking on-demand re-scraping.
    const requestQueue = await RequestQueue.open(
      `cat-${categorySlug}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    );
    for (let i = 0; i < maxPages; i++) {
      const pageNo = startPage + i;
      for (const target of targets) {
        await requestQueue.addRequest({
          url: this.collectionProductsJsonUrl(target, pageNo, pageSize),
          userData: { pageNo, target },
        });
      }
    }

    const crawler = new (HttpCrawler as any)({
      requestQueue,
      maxConcurrency: 1,
      maxRequestRetries: this.MAX_RETRIES,
      requestHandlerTimeoutSecs: 60,
      additionalMimeTypes: ['application/json'],
      preNavigationHooks: [
        async ({ request }: any) => {
          request.headers = {
            ...(request.headers || {}),
            'User-Agent': this.USER_AGENT,
            Accept: 'application/json',
          };
        },
      ],

      requestHandler: async ({ body, request }: any) => {
        const pageNo = request.userData.pageNo as number;
        const target = request.userData.target as string;

        let payload: any;
        try {
          payload = typeof body === 'string' ? JSON.parse(body) : JSON.parse(body.toString('utf8'));
        } catch {
          throw new Error(`Non-JSON response for ${target} page ${pageNo}`);
        }

        const raw = Array.isArray(payload?.products) ? payload.products : [];
        this.logger.log(`${target}: page ${pageNo} returned ${raw.length} products`);

        // Products are filed under the category the user asked for, which for a landing
        // page is the hub rather than the collection they came from.
        byPage.set(
          `${target}|${pageNo}`,
          raw.map((p: any) => this.toPreview(p, categorySlug)).filter(Boolean),
        );

        // A page shorter than the requested size means we reached the end of the collection.
        if (raw.length < pageSize) shortPages.push(pageNo);

        // Be kind to the origin between sequential pages.
        await this.delay();
      },

      failedRequestHandler: ({ request }: any, error: Error) => {
        scrapeError = error;
        this.logger.error(`Listing request failed (${request.url}): ${error?.message}`);
      },
    });

    try {
      await crawler.run();
    } finally {
      await crawler.teardown().catch(() => undefined);
      await requestQueue.drop().catch(() => undefined);
    }

    // Preserve catalogue order by walking pages in sequence, and stop at the first gap so a
    // failed middle page can never silently shift the checkpoint past unfetched products.
    const products: ProductPreview[] = [];
    const seen = new Set<string>();
    let lastContiguousPage = startPage - 1;

    for (let i = 0; i < maxPages; i++) {
      const pageNo = startPage + i;

      // A page counts as fetched only when every target returned it, so a failure in one
      // collection of a hub cannot advance the checkpoint past unfetched products.
      const perTarget = targets.map((t) => byPage.get(`${t}|${pageNo}`));
      if (perTarget.some((entry) => !entry)) break;

      lastContiguousPage = pageNo;
      for (const pageProducts of perTarget) {
        for (const p of pageProducts!) {
          if (seen.has(p.source_id)) continue;
          seen.add(p.source_id);
          products.push(p);
        }
      }

      // Exhausted only once every target has run short on this page.
      if (this.allTargetsShort(shortPages, pageNo, targets.length)) break;
    }

    const pagesFetched = lastContiguousPage - startPage + 1;

    if (pagesFetched <= 0) {
      const reason = scrapeError ? `: ${(scrapeError as Error).message}` : '';
      throw new Error(`Listing scrape for "${categorySlug}" produced no pages${reason}`);
    }

    const exhausted = this.allTargetsShort(shortPages, lastContiguousPage, targets.length);

    return {
      products,
      pagesFetched,
      nextPage: exhausted ? null : lastContiguousPage + 1,
      exhausted,
    };
  }

  private toPreview(p: any, categorySlug: string): ProductPreview | null {
    return this.toProductPreview(p, categorySlug);
  }

  private allTargetsShort(shortPages: number[], pageNo: number, targetCount: number): boolean {
    return shortPages.filter((p) => p === pageNo).length >= targetCount;
  }

  /**
   * Which collections to read for a category. Most menu entries are collections and resolve
   * to themselves; entries pointing at /pages/ landing pages (Romance, Graphic Novels,
   * Music, ...) have no feed, so they resolve to the collections that page links to.
   */
  private async resolveTargets(categorySlug: string): Promise<string[]> {
    if (await this.hasCollectionFeed(categorySlug)) return [categorySlug];

    const hub = await this.resolveHubCollections(categorySlug);
    if (hub.length > 0) return hub;

    // Nothing better to try — let the normal crawl run and report its own failure.
    this.logger.warn(`"${categorySlug}" has no collection feed and no linked collections`);
    return [categorySlug];
  }

  /**
   * The storefront answers an unknown collection with 200 and {"products":[]} rather than
   * 404, so a non-empty first page is the only reliable proof that a slug is a collection.
   */
  private async hasCollectionFeed(slug: string): Promise<boolean> {
    try {
      const res = await fetch(this.collectionProductsJsonUrl(slug, 1, 1), {
        headers: { 'User-Agent': this.USER_AGENT, Accept: 'application/json' },
      });
      if (!res.ok) return false;

      const payload = await res.json();
      return Array.isArray(payload?.products) && payload.products.length > 0;
    } catch (error) {
      // Network trouble is not evidence of a landing page; let the crawler retry normally.
      this.logger.warn(`Feed probe for ${slug} failed: ${error.message}`);
      return true;
    }
  }

  private async resolveHubCollections(hubSlug: string): Promise<string[]> {
    const cached = this.hubCollections.get(hubSlug);
    if (cached) return cached;

    const found: string[] = [];
    const requestQueue = await RequestQueue.open(
      `hub-${hubSlug}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    );
    await requestQueue.addRequest({ url: `${this.siteRoot}/pages/${hubSlug}` });

    const crawler = new (CheerioCrawler as any)({
      requestQueue,
      maxConcurrency: 1,
      maxRequestRetries: this.MAX_RETRIES,
      requestHandler: async ({ $ }: any) => {
        // The mega-menu and footer link to most of the catalogue; only the body content
        // says what this particular landing page is about.
        $('header, footer, nav, onstate-mega-menu').remove();

        $('a[href*="/collections/"]').each((_: number, el: any) => {
          const href = $(el).attr('href') || '';
          const match = href.match(/\/collections\/([^/?#]+)/);
          if (!match || match[1] === 'all') return;
          if (!found.includes(match[1])) found.push(match[1]);
        });
      },
      failedRequestHandler: ({ request }: any, error: Error) => {
        this.logger.warn(`Landing page fetch failed (${request.url}): ${error?.message}`);
      },
    });

    try {
      await crawler.run();
    } finally {
      await crawler.teardown().catch(() => undefined);
      await requestQueue.drop().catch(() => undefined);
    }

    // Cap the fan-out: a hub linking to 30 collections should not mean 30 feed requests.
    const resolved = found.slice(0, this.MAX_HUB_COLLECTIONS);
    this.hubCollections.set(hubSlug, resolved);

    if (resolved.length > 0) {
      this.logger.log(`Landing page "${hubSlug}" resolves to: ${resolved.join(', ')}`);
    }
    return resolved;
  }
}
