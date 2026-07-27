import { Injectable } from '@nestjs/common';
import { HttpCrawler, RequestQueue } from 'crawlee';
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

  async scrape(categorySlug: string, options: CategoryScrapeOptions = {}): Promise<CategoryScrapeResult> {
    const pageSize = options.pageSize ?? this.DEFAULT_PAGE_SIZE;
    const maxPages = Math.max(1, options.maxPages ?? this.DEFAULT_MAX_PAGES);
    const startPage = Math.max(1, options.startPage ?? 1);

    const byPage = new Map<number, ProductPreview[]>();
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
      await requestQueue.addRequest({
        url: this.collectionProductsJsonUrl(categorySlug, pageNo, pageSize),
        userData: { pageNo },
      });
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

        let payload: any;
        try {
          payload = typeof body === 'string' ? JSON.parse(body) : JSON.parse(body.toString('utf8'));
        } catch {
          throw new Error(`Non-JSON response for ${categorySlug} page ${pageNo}`);
        }

        const raw = Array.isArray(payload?.products) ? payload.products : [];
        this.logger.log(`${categorySlug}: page ${pageNo} returned ${raw.length} products`);

        byPage.set(pageNo, raw.map((p: any) => this.toPreview(p, categorySlug)).filter(Boolean));

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
      const pageProducts = byPage.get(pageNo);
      if (!pageProducts) break;
      lastContiguousPage = pageNo;
      for (const p of pageProducts) {
        if (seen.has(p.source_id)) continue;
        seen.add(p.source_id);
        products.push(p);
      }
      if (shortPages.includes(pageNo)) break;
    }

    const pagesFetched = lastContiguousPage - startPage + 1;

    if (pagesFetched <= 0) {
      const reason = scrapeError ? `: ${(scrapeError as Error).message}` : '';
      throw new Error(`Listing scrape for "${categorySlug}" produced no pages${reason}`);
    }

    const exhausted = shortPages.includes(lastContiguousPage);

    return {
      products,
      pagesFetched,
      nextPage: exhausted ? null : lastContiguousPage + 1,
      exhausted,
    };
  }

  private toPreview(p: any, categorySlug: string): ProductPreview | null {
    if (!p?.id || !p?.title) return null;

    return {
      source_id: String(p.id),
      title: String(p.title).trim(),
      author: this.parseAuthorFromHandle(p.handle),
      price: this.lowestPrice(p.variants),
      currency: 'GBP', // /en-gb storefront; products.json carries no currency field
      image_url: p?.images?.[0]?.src || '',
      source_url: this.productUrl(p.handle),
      category_slug: categorySlug,
      description: this.stripHtml(p.body_html || ''),
    };
  }

  /**
   * A title has one variant per condition/location combination. The listing shows the
   * cheapest in-stock copy, so mirror that; fall back to the cheapest of any variant.
   */
  private lowestPrice(variants: any[]): number {
    if (!Array.isArray(variants) || variants.length === 0) return 0;

    const prices = (available: boolean) =>
      variants
        .filter((v) => (available ? v?.available : true))
        .map((v) => parseFloat(v?.price))
        .filter((n) => !isNaN(n) && n > 0);

    const inStock = prices(true);
    const pool = inStock.length > 0 ? inStock : prices(false);
    return pool.length > 0 ? Math.min(...pool) : 0;
  }
}
