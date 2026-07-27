// backend/src/modules/scraper/scrapers/interactive.scraper.ts
import { Injectable, Logger } from '@nestjs/common';
import * as playwright from 'playwright';
import { BaseScraper } from './base.scraper';

export interface InteractiveScrapeResult {
  products: any[];
  status: 'success' | 'partial' | 'failed';
  message: string;
  totalScraped: number;
  hasMore: boolean;
}

export interface PageState {
  url: string;
  title: string;
  loadedSelectors: string[];
  productCount: number;
}

@Injectable()
export class InteractiveScraper extends BaseScraper {
  protected readonly logger = new Logger(InteractiveScraper.name);
  // Taken from the live storefront markup, not guessed. A submenu entry looks like:
  //   <a href="/collections/crime-and-mystery-books" data-menu_category="Fiction Books"
  //      data-menu_subcategory="Crime &amp; Mystery" aria-hidden="true" role="presentation">
  // The panel is aria-hidden and CSS-hidden until its group is hovered, so a link can only
  // be clicked after opening the group it belongs to.
  private readonly SELECTORS = {
    // Navigation
    MENU_ROOT: 'onstate-mega-menu.header__inline-menu',
    GROUP_ITEM: 'li.has-submenu',
    GROUP_LINK: 'a[data-menu_category]',
    SUBMENU: '.onstate-mega-menu__submenu',
    SUBCATEGORY_LINK: 'a[data-menu_subcategory]',

    // Product Details
    PRODUCT_DETAIL: '.product-accordion, .product-description, #product-description',
    DESCRIPTION: '.description, .product-info, .product-details',
    SPECS_TABLE: '.additional-info-table, .specs-table, .product-specs',

    // Cookies
    COOKIE_CONSENT: '#onetrust-consent-sdk, .onetrust-pc-dark-filter, .cookie-banner',
    COOKIE_ACCEPT: '#onetrust-accept-btn-handler, button[aria-label="Accept"], .accept-cookies',
  };

  /** Floating elements that sit over the header and block menu interaction. */
  private readonly OVERLAY_SELECTORS = [
    'autodetect-root',
    '.adt-banner',
    '#onetrust-consent-sdk',
    '.onetrust-pc-dark-filter',
    '[id^="attentive_"]',
  ];

  /** Products per request against the collection feed. */
  private readonly PAGE_SIZE = 40;

  /** Upper bound on feed requests made for one landing page. */
  private readonly MAX_HUB_COLLECTIONS = 6;

  /** Landing page slug -> collections it links to. Stable enough to resolve once. */
  private readonly hubCollections = new Map<string, string[]>();

  async initializeBrowser(): Promise<{ browser: playwright.Browser; context: playwright.BrowserContext; page: playwright.Page }> {
    this.logger.log('Initializing Playwright browser for interactive session');

    // --single-process/--no-zygote were here and are why launches died with "Target page,
    // context or browser has been closed": Chromium crashes under them when more than one
    // browser starts at once, which is exactly what happens when a second tab connects.
    const browser = await this.launchWithRetry({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu',
        '--window-size=1920,1080',
      ],
    });

    const context = await browser.newContext({
      userAgent: this.USER_AGENT,
      viewport: { width: 1920, height: 1080 },
      javaScriptEnabled: true,
      ignoreHTTPSErrors: true,
    });

    const page = await context.newPage();
    
    // Set navigation timeout
    page.setDefaultNavigationTimeout(30000);
    page.setDefaultTimeout(15000);
    
    // Intercept requests to block unnecessary resources
    await page.route('**/*.{png,jpg,jpeg,gif,css,woff,woff2,ttf,eot,svg}', route => route.abort());
    
    return { browser, context, page };
  }

  /**
   * Wait until the mega-menu has finished building itself.
   *
   * The storefront injects submenu links progressively, so a search that runs as soon as the
   * menu root exists sees a half-built tree: no matching entry, hover and click both "fail"
   * within a second, and all three attempts burn instantly. Poll until the link count stops
   * growing (the same approach navigation.scraper.ts uses) rather than guessing a fixed wait.
   */
  private async waitForMenuReady(page: playwright.Page, timeoutMs = 15000): Promise<boolean> {
    const started = Date.now();
    const selector = `${this.SELECTORS.MENU_ROOT} ${this.SELECTORS.SUBCATEGORY_LINK}`;
    let previous = -1;
    let stableStreak = 0;

    while (Date.now() - started < timeoutMs) {
      const count = await page
        .evaluate((sel: string) => document.querySelectorAll(sel).length, selector)
        .catch(() => 0);

      if (count > 0 && count === previous) {
        // Two identical readings in a row — the menu has settled.
        if (++stableStreak >= 2) {
          this.logger.debug(`Menu ready with ${count} submenu links`);
          return true;
        }
      } else {
        stableStreak = 0;
      }

      previous = count;
      await this.delay(500);
    }

    this.logger.warn(`Menu did not settle within ${timeoutMs}ms (${previous} links seen)`);
    return previous > 0;
  }

  /** A launch can still lose a race for resources; one retry costs little and saves a session. */
  private async launchWithRetry(options: playwright.LaunchOptions): Promise<playwright.Browser> {
    const attempts = 2;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await playwright.chromium.launch(options);
      } catch (error) {
        if (attempt === attempts) throw error;
        this.logger.warn(`Browser launch attempt ${attempt}/${attempts} failed: ${error.message}`);
        await this.delay(1000);
      }
    }

    throw new Error('unreachable');
  }

  async navigateToHomepage(page: playwright.Page): Promise<void> {
    this.logger.log('Navigating to World of Books homepage');

    await page.goto(this.siteRoot, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });

    await this.handleCookieConsent(page);
    await this.dismissOverlays(page);

    try {
      await page.waitForSelector(this.SELECTORS.MENU_ROOT, { timeout: 20000 });
    } catch {
      this.logger.warn('Mega-menu did not appear before the timeout');
    }

    await this.waitForMenuReady(page);
    this.logger.log('Homepage loaded successfully');
  }

  /**
   * Open a top-level section's mega-menu panel. `target` may be a slug ("fiction-books") or
   * the heading text ("Fiction Books") — both are normalised before comparing, so no
   * hand-maintained slug-to-label map is needed.
   */
  async hoverNavigation(page: playwright.Page, target: string, _navigationSlug?: string): Promise<boolean> {
    this.logger.log(`Attempting to hover over navigation: ${target}`);

    try {
      await this.dismissOverlays(page);
      await this.waitForMenuReady(page);

      const groupLink = await this.findGroupLink(page, target);
      if (!groupLink) {
        this.logger.warn(`No navigation heading matched "${target}"`);
        return false;
      }

      await groupLink.scrollIntoViewIfNeeded().catch(() => undefined);
      await groupLink.hover({ timeout: 5000 });
      await this.delay(800);

      const opened = await this.isSubmenuOpen(page, groupLink);
      this.logger.log(`Hovered over navigation "${target}" (panel open: ${opened})`);
      return true;

    } catch (error) {
      this.logger.warn(`Hover failed for ${target}: ${error.message}`);
      return false;
    }
  }

  /** Match a top-level heading by slug or label, e.g. "music-and-film" or "Music & Film". */
  private async findGroupLink(page: playwright.Page, target: string): Promise<playwright.ElementHandle | null> {
    const wanted = this.normalizeLabel(target);

    const items = await page.$$(`${this.SELECTORS.MENU_ROOT} ${this.SELECTORS.GROUP_ITEM}`);
    for (const item of items) {
      const link = await item.$(this.SELECTORS.GROUP_LINK);
      if (!link) continue;

      const label = (await link.getAttribute('data-menu_category')) || (await link.textContent()) || '';
      const href = (await link.getAttribute('href')) || '';

      if (this.normalizeLabel(label) === wanted || this.normalizeLabel(this.extractSlugFromUrl(href)) === wanted) {
        return link;
      }
    }
    return null;
  }

  private async isSubmenuOpen(page: playwright.Page, groupLink: playwright.ElementHandle): Promise<boolean> {
    return await page.evaluate(
      ([link, submenuSelector]: [any, string]) => {
        const li = (link as Element).closest('li');
        const panel = li?.querySelector(submenuSelector) as HTMLElement | null;
        if (!panel) return false;
        return panel.getAttribute('aria-hidden') !== 'true' && panel.offsetParent !== null;
      },
      [groupLink, this.SELECTORS.SUBMENU] as [any, string],
    );
  }

  /** "Music & Film", "music-and-film" and "Music and Film" all normalise to the same key. */
  private normalizeLabel(value: string): string {
    return String(value)
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Click a category the way a person would: open its section's panel, then click the link.
   * Returns false rather than navigating directly, so the caller can decide whether to
   * retry from a fresh homepage — a silent `goto` would hide a broken menu forever.
   */
  async clickCategory(page: playwright.Page, categorySlug: string, target?: string): Promise<boolean> {
    this.logger.log(`Attempting to click category: ${categorySlug}`);

    try {
      // Search only once the menu has finished rendering, otherwise a slow build reads as
      // "no such category" and burns an attempt in under a second.
      await this.waitForMenuReady(page);

      const found = await this.findSubcategoryLink(page, categorySlug, target);
      if (!found) {
        this.logger.warn(`No menu entry found for "${categorySlug}"`);
        return false;
      }

      // Open the owning panel first: the links are aria-hidden with no layout box until
      // their group is hovered, so clicking without this always times out.
      const { link, groupLabel } = found;
      if (groupLabel) {
        await this.hoverNavigation(page, groupLabel);
      }

      // The banner can slide back in between opening the panel and clicking.
      await this.dismissOverlays(page);

      // The panel animates open; clicking before the link has a box throws immediately.
      await link.waitForElementState('visible', { timeout: 5000 }).catch(() => {
        this.logger.debug(`Link for "${categorySlug}" still not visible; clicking anyway`);
      });

      await link.scrollIntoViewIfNeeded().catch(() => undefined);
      await link.click({ timeout: 10000 });
      await page.waitForLoadState('domcontentloaded');
      await this.delay(1500);

      const landed = page.url();
      const onTarget = landed.includes(categorySlug);
      this.logger.log(
        onTarget
          ? `Clicked category "${categorySlug}" — now at ${landed}`
          : `Clicked "${categorySlug}" but landed on ${landed}`,
      );

      return onTarget;

    } catch (error) {
      this.logger.warn(`Failed to click category ${categorySlug}: ${error.message}`);
      return false;
    }
  }

  /** Locate a submenu link by its collection/page slug, preferring the given section. */
  private async findSubcategoryLink(
    page: playwright.Page,
    categorySlug: string,
    preferredGroup?: string,
  ): Promise<{ link: playwright.ElementHandle; groupLabel: string } | null> {
    const links = await page.$$(`${this.SELECTORS.MENU_ROOT} ${this.SELECTORS.SUBCATEGORY_LINK}`);
    const matches: { link: playwright.ElementHandle; groupLabel: string }[] = [];

    for (const link of links) {
      const href = (await link.getAttribute('href')) || '';
      if (!href || this.extractSlugFromUrl(href) !== categorySlug) continue;

      matches.push({
        link,
        groupLabel: (await link.getAttribute('data-menu_category')) || '',
      });
    }

    if (matches.length === 0) return null;

    // A collection can appear under more than one section; prefer the one the user came from.
    if (preferredGroup) {
      const wanted = this.normalizeLabel(preferredGroup);
      const preferred = matches.find((m) => this.normalizeLabel(m.groupLabel) === wanted);
      if (preferred) return preferred;
    }

    return matches[0];
  }

  /**
   * Read a page of the collection.
   *
   * The listing grid is rendered client-side by Algolia InstantSearch
   * (`algolia_plp_main_collection_product_grid`). It regularly fails to resolve — the page
   * keeps `#skeleton-loader` and logs "Unreachable hosts" — which is what made live scraping
   * succeed only sometimes. Shopify serves the same catalogue as JSON at
   * /collections/<slug>/products.json, so we read that from inside the session's own page:
   * same origin, same cookies, same session the user's clicks are driving.
   */
  async scrapeProductsFromPage(
    page: playwright.Page,
    categorySlug: string,
    maxProducts: number = this.PAGE_SIZE,
    pageNo = 1,
  ): Promise<any[]> {
    try {
      const limit = Math.max(1, Math.min(250, maxProducts));
      const direct = await this.fetchCollectionFeed(page, categorySlug, limit, pageNo);

      if (direct.status === 'ok' && direct.entries!.length > 0) {
        const products = direct.entries!
          .map((p: any) => this.toProductPreview(p, categorySlug))
          .filter(Boolean);
        this.logger.log(`${categorySlug}: page ${pageNo} yielded ${products.length} products`);
        return products;
      }

      // Not a collection — some menu entries point at /pages/ landing pages instead
      // (Graphic Novels, Music, Travel, ...). Those have no feed of their own, so gather
      // from the collections the landing page links to.
      //
      // Note the storefront answers an unknown collection with 200 and {"products":[]},
      // never 404, so an empty first page is the only signal that this is not a collection.
      // Once a slug is known to be a hub, later pages must go the same way too, otherwise
      // "load more" reads an empty collection feed and stops after the first page.
      const knownHub = this.hubCollections.has(categorySlug);
      if (direct.status === 'not-found' || (direct.status === 'ok' && (pageNo === 1 || knownHub))) {
        return await this.scrapeHubPage(page, categorySlug, limit, pageNo);
      }

      if (direct.status === 'ok') return []; // genuinely past the end of the collection

      this.logger.warn(`Collection feed for ${categorySlug} page ${pageNo}: ${direct.status}`);
      return [];

    } catch (error) {
      this.logger.warn(`Failed to read products for ${categorySlug}: ${error.message}`);
      return [];
    }
  }

  private async fetchCollectionFeed(
    page: playwright.Page,
    slug: string,
    limit: number,
    pageNo: number,
  ): Promise<{ status: 'ok' | 'not-found' | string; entries?: any[] }> {
    const path = `/collections/${slug}/products.json?limit=${limit}&page=${pageNo}`;

    const raw = await page.evaluate(async (url: string) => {
      try {
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (res.status === 404) return { status: 'not-found' };
        if (!res.ok) return { status: `HTTP ${res.status}` };
        const json = await res.json();
        return { status: 'ok', products: json?.products };
      } catch (e: any) {
        return { status: `fetch failed: ${e?.message || e}` };
      }
    }, path);

    if (raw?.status !== 'ok') return { status: raw?.status || 'unknown error' };
    return { status: 'ok', entries: Array.isArray(raw.products) ? raw.products : [] };
  }

  /**
   * Treat a /pages/ entry as a hub: read the collections it links to and pull the same page
   * from each, so the category shows books rather than nothing. Results keep the hub's slug
   * as their category, which is where the user asked for them.
   */
  private async scrapeHubPage(
    page: playwright.Page,
    hubSlug: string,
    limit: number,
    pageNo: number,
  ): Promise<any[]> {
    const collections = await this.resolveHubCollections(page, hubSlug);
    if (collections.length === 0) {
      this.logger.warn(`"${hubSlug}" is neither a collection nor a landing page with collections`);
      return [];
    }

    const products: any[] = [];
    const seen = new Set<string>();

    for (const slug of collections) {
      if (products.length >= limit) break;

      const feed = await this.fetchCollectionFeed(page, slug, limit - products.length, pageNo);
      if (feed.status !== 'ok') continue;

      for (const entry of feed.entries || []) {
        const mapped = this.toProductPreview(entry, hubSlug);
        if (!mapped || seen.has(mapped.source_id)) continue;
        seen.add(mapped.source_id);
        products.push(mapped);
        if (products.length >= limit) break;
      }
    }

    this.logger.log(
      `${hubSlug}: page ${pageNo} yielded ${products.length} products from ${collections.length} linked collections`,
    );
    return products;
  }

  /** Collections linked from a landing page's body, excluding the site chrome. */
  private async resolveHubCollections(page: playwright.Page, hubSlug: string): Promise<string[]> {
    const cached = this.hubCollections.get(hubSlug);
    if (cached) return cached;

    const slugs: string[] = await page.evaluate(async (slug: string) => {
      try {
        const res = await fetch(`/pages/${slug}`, { headers: { Accept: 'text/html' } });
        if (!res.ok) return [];

        const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
        // The mega-menu and footer link to most of the catalogue; only body content says
        // what this particular landing page is about.
        doc.querySelectorAll('header, footer, nav, onstate-mega-menu').forEach((el) => el.remove());

        const found: string[] = [];
        for (const a of Array.from(doc.querySelectorAll('a[href*="/collections/"]'))) {
          const href = a.getAttribute('href') || '';
          const match = href.match(/\/collections\/([^/?#]+)/);
          if (!match) continue;
          if (match[1] === 'all' || found.includes(match[1])) continue;
          found.push(match[1]);
        }
        return found;
      } catch {
        return [];
      }
    }, hubSlug);

    // Cap the fan-out: a hub linking to 30 collections should not mean 30 feed requests.
    const resolved = slugs.slice(0, this.MAX_HUB_COLLECTIONS);
    this.hubCollections.set(hubSlug, resolved);

    this.logger.log(
      resolved.length > 0
        ? `Landing page "${hubSlug}" resolves to collections: ${resolved.join(', ')}`
        : `Landing page "${hubSlug}" links to no collections`,
    );
    return resolved;
  }

  /**
   * Whether a further page exists. The storefront's "Load More" button belongs to the
   * Algolia grid, so paging is driven off the feed instead.
   */
  async hasMorePages(page: playwright.Page, categorySlug: string, nextPage: number): Promise<boolean> {
    const next = await this.scrapeProductsFromPage(page, categorySlug, 1, nextPage);
    return next.length > 0;
  }

  async getProductDetails(page: playwright.Page, productUrl: string): Promise<any> {
    this.logger.log(`Getting product details from: ${productUrl}`);
    
    try {
      await page.goto(productUrl, { waitUntil: 'networkidle' });
      await this.delay(2000);
      
      const details: any = {
        description: '',
        specs: {},
        reviews: [],
        related_products: [],
      };
      
      // Extract description
      try {
        const descriptionEl = await page.$(this.SELECTORS.PRODUCT_DETAIL);
        if (descriptionEl) {
          const description = await descriptionEl.textContent();
          details.description = description?.trim() || '';
        }
      } catch {
        // Ignore
      }
      
      // Extract specs from table
      try {
        const tableEl = await page.$(this.SELECTORS.SPECS_TABLE);
        if (tableEl) {
          const rows = await tableEl.$$('tr');
          
          for (const row of rows) {
            const cells = await row.$$('td');
            if (cells.length >= 2) {
              const key = await cells[0].textContent();
              const value = await cells[1].textContent();
              
              if (key && value) {
                const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
                details.specs[cleanKey] = value.trim();
              }
            }
          }
        }
      } catch {
        // Ignore
      }
      
      return details;
      
    } catch (error) {
      this.logger.error(`Failed to get product details:`, error);
      throw error;
    }
  }

  /**
   * Clear anything floating above the page that would swallow a hover or click.
   *
   * The storefront slides in a promo banner (`<autodetect-root class="... adt-banner">`)
   * a few seconds after load, pinned over the header. Playwright refuses to act on an
   * element another node covers, so every menu interaction failed with "intercepts pointer
   * events" until this ran. Banners can appear late, so this is called before each action
   * rather than once per page load.
   */
  private async dismissOverlays(page: playwright.Page): Promise<void> {
    try {
      const removed = await page.evaluate((selectors: string[]) => {
        let count = 0;
        for (const selector of selectors) {
          for (const el of Array.from(document.querySelectorAll(selector))) {
            el.remove();
            count++;
          }
        }
        return count;
      }, this.OVERLAY_SELECTORS);

      if (removed > 0) this.logger.debug(`Removed ${removed} overlay element(s)`);
    } catch (error) {
      this.logger.debug(`Overlay cleanup skipped: ${error.message}`);
    }
  }

  private async handleCookieConsent(page: playwright.Page): Promise<void> {
    try {
      const cookieConsent = await page.$(this.SELECTORS.COOKIE_CONSENT);
      if (cookieConsent) {
        this.logger.log('Accepting cookie consent...');
        
        const acceptButton = await page.$(this.SELECTORS.COOKIE_ACCEPT);
        if (acceptButton) {
          await acceptButton.click();
          await this.delay(2000);
        }
      }
    } catch (error) {
      this.logger.warn('Cookie consent handling failed:', error.message);
    }
  }

  /**
   * Abstract method implementation from BaseScraper
   * Delegates to the interactive scraping workflow
   */
  async scrape(url: string, data?: any): Promise<InteractiveScrapeResult> {
    const { categorySlug, maxProducts = 100, navigationSlug } = data || {};
    
    if (!categorySlug) {
      throw new Error('categorySlug is required for interactive scraping');
    }
    
    this.logger.log(`Starting interactive scrape for category: ${categorySlug}`);
    
    let browser: playwright.Browser | undefined;
    try {
      const launched = await this.initializeBrowser();
      browser = launched.browser;
      const page = launched.page;

      await this.navigateToHomepage(page);
      if (navigationSlug) {
        await this.hoverNavigation(page, navigationSlug);
      }

      if (!(await this.clickCategory(page, categorySlug, navigationSlug))) {
        await page.goto(this.collectionUrl(categorySlug), {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
        await this.delay(1000);
      }

      // Walk the collection feed a page at a time until the requested count is reached.
      const allProducts: any[] = [];
      let pageNo = 1;
      let hasMore = true;

      while (hasMore && allProducts.length < maxProducts) {
        const pageProducts = await this.scrapeProductsFromPage(
          page,
          categorySlug,
          Math.min(this.PAGE_SIZE, maxProducts - allProducts.length),
          pageNo,
        );
        allProducts.push(...pageProducts);

        hasMore = pageProducts.length > 0;
        pageNo++;
        if (hasMore) await this.delay();
      }

      return {
        products: allProducts.slice(0, maxProducts),
        status: allProducts.length > 0 ? 'success' : 'partial',
        message: `Scraped ${allProducts.length} products`,
        totalScraped: allProducts.length,
        hasMore: allProducts.length >= maxProducts,
      };

    } catch (error) {
      this.logger.error(`Interactive scrape failed for ${categorySlug}:`, error);
      return {
        products: [],
        status: 'failed',
        message: error.message,
        totalScraped: 0,
        hasMore: false,
      };
    } finally {
      await browser?.close().catch(() => undefined);
    }
  }
}