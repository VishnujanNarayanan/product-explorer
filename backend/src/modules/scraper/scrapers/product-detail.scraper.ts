import { Injectable } from '@nestjs/common';
import { PlaywrightCrawler, RequestQueue } from 'crawlee';
import { BaseScraper } from './base.scraper';

export interface ProductSpecs {
  isbn13?: string;
  isbn10?: string;
  publisher?: string;
  year_published?: string;
  binding_type?: string;
  condition?: string;
  pages?: number;
  sku?: string;
  format?: string;
  category_path?: string;
  author_bio?: string;
}

export interface RelatedProduct {
  source_id: string;
  title: string;
  author: string | null;
  url: string;
  price: number;
  image_url: string;
}

export interface ProductDetailData {
  source_id: string;
  title: string;
  author: string | null;
  description: string;
  image_url: string;
  specs: ProductSpecs;
  /**
   * World of Books product pages carry no review or rating markup — verified by scanning for
   * [class*="rating"], [class*="review"], [class*="star"] and [data-rating] (zero matches).
   * The assignment asks for reviews "if present", so these stay null/0 rather than being
   * synthesised from marketing copy.
   */
  ratings_avg: number | null;
  reviews_count: number;
  related_products: RelatedProduct[];
}

/**
 * Scrapes a single product page with a real browser (Crawlee + Playwright).
 *
 * Runs lazily — only when a user opens a product — so detail pages are never bulk-fetched.
 * The primary source is the page's schema.org JSON-LD `Book` node, which carries clean
 * author, publisher, ISBN, page count and format. The visible "Additional information" table
 * (stable `#info-*` ids) fills in condition and SKU. Related products come from Shopify's
 * recommendations endpoint, fetched from inside the page so the call stays same-origin —
 * the previous `.algolia-related-products-container` selector cannot work, because that
 * widget is rendered client-side by Algolia and never populates for us.
 */
@Injectable()
export class ProductDetailScraper extends BaseScraper {
  private readonly SELECTORS = {
    COOKIE_ACCEPT: '#onetrust-accept-btn-handler',
    TITLE: 'h1',
    INFO_SKU: '#info-sku',
    INFO_ISBN13: '#info-isbn13',
    INFO_ISBN10: '#info-isbn10',
    INFO_PUBLISHER: '#info-publisher',
    INFO_YEAR_PUBLISHED: '#info-year-published',
    INFO_BINDING_TYPE: '#info-binding-type',
    INFO_CONDITION: '#info-condition',
    INFO_PAGES: '#info-number-of-pages',
    ACCORDION_HEAD: '.accordion-head, [class*="accordion-head"]',
  };

  async scrape(url: string, sourceId?: string): Promise<ProductDetailData> {
    let result: ProductDetailData | null = null;
    let scrapeError: Error | null = null;

    // Isolated queue per run so re-scraping the same product is not skipped as "already
    // handled" by Crawlee's persisted default queue.
    const requestQueue = await RequestQueue.open(`detail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    await requestQueue.addRequest({ url });

    const crawler = new (PlaywrightCrawler as any)({
      requestQueue,
      maxRequestsPerCrawl: 1,
      maxConcurrency: 1,
      requestHandlerTimeoutSecs: 90,
      maxRequestRetries: this.MAX_RETRIES,
      launchContext: {
        launchOptions: { headless: true },
        userAgent: this.USER_AGENT,
      },
      preNavigationHooks: [
        async ({ page }: any) => {
          await page.setViewportSize({ width: 1920, height: 1080 });
        },
      ],

      requestHandler: async ({ page, request }: any) => {
        this.logger.log(`Scraping product detail: ${request.url}`);

        await this.acceptCookies(page);
        await page.waitForSelector(this.SELECTORS.TITLE, { timeout: 30000 });
        await this.delay(1000);

        const scraped = await page.evaluate(async (S: any) => {
          const text = (sel: string) => {
            const el = document.querySelector(sel);
            return el ? (el.textContent || '').trim().replace(/\s+/g, ' ') : null;
          };

          // --- schema.org JSON-LD ---
          const blocks: any[] = [];
          document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
            try {
              const parsed = JSON.parse(s.textContent || '');
              if (Array.isArray(parsed)) blocks.push(...parsed);
              else blocks.push(parsed);
            } catch {
              /* ignore malformed blocks */
            }
          });
          const book = blocks.find((b) => b && b['@type'] === 'Book') || null;
          const product = blocks.find((b) => b && b['@type'] === 'Product') || null;

          // --- accordion panels, identified by their heading ---
          // Layout is `.accordion-head` followed by a sibling `div.panel`. Headings are
          // "<Title> Summary", "About <Author>" and "Additional information"; the last one
          // is the spec table and must not be mistaken for the description.
          let summary = '';
          let authorBio = '';
          document.querySelectorAll(S.ACCORDION_HEAD).forEach((head) => {
            const label = (head.textContent || '').trim().replace(/\s+/g, ' ');
            const panel = head.nextElementSibling;
            if (!panel) return;
            const body = (panel.textContent || '').trim().replace(/\s+/g, ' ');
            if (!body) return;

            if (/summary\s*$/i.test(label)) {
              if (body.length > summary.length) summary = body;
            } else if (/^about\b/i.test(label)) {
              if (body.length > authorBio.length) authorBio = body;
            }
          });

          // --- Shopify product id, required by the recommendations endpoint ---
          const w = window as any;
          const shopifyId = w?.ShopifyAnalytics?.meta?.product?.id || w?.meta?.product?.id || null;

          // --- related products (same-origin fetch) ---
          let related: any[] = [];
          if (shopifyId) {
            try {
              const r = await fetch(
                `/en-gb/recommendations/products.json?product_id=${shopifyId}&limit=6`,
                { headers: { Accept: 'application/json' } },
              );
              if (r.ok) {
                const j = await r.json();
                related = Array.isArray(j?.products) ? j.products : [];
              }
            } catch {
              /* recommendations are best-effort */
            }
          }

          return {
            h1: text(S.TITLE),
            book,
            product,
            summary,
            authorBio,
            shopifyId: shopifyId ? String(shopifyId) : null,
            related,
            info: {
              sku: text(S.INFO_SKU),
              isbn13: text(S.INFO_ISBN13),
              isbn10: text(S.INFO_ISBN10),
              publisher: text(S.INFO_PUBLISHER),
              year_published: text(S.INFO_YEAR_PUBLISHED),
              binding_type: text(S.INFO_BINDING_TYPE),
              condition: text(S.INFO_CONDITION),
              pages: text(S.INFO_PAGES),
            },
          };
        }, this.SELECTORS);

        result = this.assemble(scraped, url, sourceId);
        this.logger.log(
          `Detail scraped: "${result.title}" by ${result.author ?? 'unknown'} ` +
            `(${result.related_products.length} related)`,
        );
      },

      failedRequestHandler: ({ request }: any, error: Error) => {
        scrapeError = error;
        this.logger.error(`Product detail request failed (${request.url}): ${error?.message}`);
      },
    });

    try {
      await crawler.run();
    } finally {
      await crawler.teardown().catch(() => undefined);
      await requestQueue.drop().catch(() => undefined);
    }

    if (!result) {
      const reason = scrapeError ? `: ${(scrapeError as Error).message}` : '';
      throw new Error(`Product detail scrape produced no result for ${url}${reason}`);
    }

    return result;
  }

  private assemble(s: any, url: string, sourceId?: string): ProductDetailData {
    const book = s.book || {};
    const product = s.product || {};

    const author =
      (book.author && (book.author.name || book.author)) ||
      this.parseAuthorFromHandle(this.extractSlugFromUrl(url)) ||
      this.authorFromHeading(s.h1) ||
      null;

    const title = book.name || product.name || this.titleFromHeading(s.h1) || 'Unknown title';

    // Prefer the on-page summary panel; the JSON-LD description is a short marketing blurb.
    const description = this.longest([s.summary, book.description, product.description]);

    const pages = parseInt(s.info.pages || book.numberOfPages || '', 10);

    const specs: ProductSpecs = this.compact({
      isbn13: s.info.isbn13 || book.isbn || undefined,
      isbn10: s.info.isbn10 || undefined,
      publisher: s.info.publisher || book.publisher?.name || undefined,
      year_published: s.info.year_published || book.datePublished || undefined,
      binding_type: s.info.binding_type || book.bookFormat || undefined,
      condition: s.info.condition || undefined,
      pages: isNaN(pages) ? undefined : pages,
      sku: s.info.sku || undefined,
      format: book.bookFormat || undefined,
      category_path: product.category || undefined,
      author_bio: s.authorBio || undefined,
    });

    const image = this.absoluteUrl(
      book.image || (Array.isArray(product.image) ? product.image[0] : product.image) || '',
    );

    return {
      source_id: s.shopifyId || sourceId || this.extractSlugFromUrl(url),
      title: String(title).trim(),
      author: author ? String(author).trim() : null,
      description,
      image_url: image,
      specs,
      ratings_avg: null,
      reviews_count: 0,
      related_products: this.mapRelated(s.related),
    };
  }

  private mapRelated(related: any[]): RelatedProduct[] {
    if (!Array.isArray(related)) return [];
    return related
      .filter((p) => p?.id && p?.title)
      .map((p) => ({
        source_id: String(p.id),
        title: String(p.title).trim(),
        author: this.parseAuthorFromHandle(p.handle),
        url: this.productUrl(p.handle),
        price: this.lowestPrice(p.variants),
        image_url: p?.images?.[0]?.src || p?.featured_image || '',
      }));
  }

  /**
   * The recommendations endpoint and products.json disagree on price format: the former
   * returns integer minor units (400 = £4.00), the latter a decimal string ("3.70").
   * Normalise to major units so both paths store comparable values.
   */
  private lowestPrice(variants: any[]): number {
    if (!Array.isArray(variants)) return 0;
    const prices = variants
      .map((v) => (typeof v?.price === 'number' ? v.price / 100 : parseFloat(v?.price)))
      .filter((n) => !isNaN(n) && n > 0);
    return prices.length ? Math.min(...prices) : 0;
  }

  /** "The Housemaid by Freida Mcfadden" -> "Freida Mcfadden" */
  private authorFromHeading(h1?: string): string | null {
    if (!h1) return null;
    const m = h1.match(/\bby\s+(.+)$/i);
    return m ? m[1].trim() : null;
  }

  private titleFromHeading(h1?: string): string | null {
    if (!h1) return null;
    return h1.replace(/\s+by\s+.+$/i, '').trim() || null;
  }

  private longest(candidates: (string | undefined | null)[]): string {
    return candidates
      .map((c) => (c || '').trim())
      .reduce((best, cur) => (cur.length > best.length ? cur : best), '');
  }

  private compact<T extends Record<string, any>>(obj: T): T {
    return Object.fromEntries(
      Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ''),
    ) as T;
  }

  private async acceptCookies(page: any): Promise<void> {
    try {
      await page.click(this.SELECTORS.COOKIE_ACCEPT, { timeout: 8000 });
      await this.delay(500);
    } catch {
      // Banner absent — safe to continue.
    }
  }
}
