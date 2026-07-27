import { Injectable } from '@nestjs/common';
import { PlaywrightCrawler, RequestQueue } from 'crawlee';
import { BaseScraper } from './base.scraper';

export interface NavigationItem {
  title: string;
  slug: string;
  url: string;
  hasChildren: boolean;
}

export interface CategoryItem {
  title: string;
  slug: string;
  url: string;
  parentSlug?: string;
  level: number;
}

/**
 * Scrapes the World of Books top navigation.
 *
 * The storefront renders its mega-menu into the DOM on page load and only reveals it with CSS
 * on hover. Every link is therefore already present without any interaction — hovering is not
 * required, and in a headless viewport the menu never reports itself as "visible", so hover
 * attempts can only ever time out. We load the page in a real browser and read the collapsed
 * menu markup directly.
 */
@Injectable()
export class NavigationScraper extends BaseScraper {
  private readonly SELECTORS = {
    MENU_ROOT: 'onstate-mega-menu.header__inline-menu',
    GROUP_ITEM: 'li.has-submenu',
    GROUP_LINK: 'a[data-menu_category]',
    SUBMENU: '.onstate-mega-menu__submenu',
    COLLECTION_LINK: 'a[href*="/collections/"]',
    COOKIE_ACCEPT: '#onetrust-accept-btn-handler',
  };

  async scrape(url?: string): Promise<{ navigation: NavigationItem[]; categories: CategoryItem[] }> {
    const target = url || this.siteRoot;
    const navigation: NavigationItem[] = [];
    const categories: CategoryItem[] = [];
    let scrapeError: Error | null = null;

    // Each run gets its own queue. Crawlee reuses (and persists) the default request queue
    // across crawler instances, so a repeated URL is treated as already handled and the
    // request handler never fires — which silently broke on-demand re-scraping.
    const requestQueue = await RequestQueue.open(`nav-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    await requestQueue.addRequest({ url: target });

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
          // Desktop viewport so the inline menu markup renders instead of the mobile drawer.
          await page.setViewportSize({ width: 1920, height: 1080 });
        },
      ],

      requestHandler: async ({ page, request }: any) => {
        this.logger.log(`Scraping navigation from: ${request.url}`);

        await this.acceptCookies(page);
        await page.waitForSelector(this.SELECTORS.MENU_ROOT, { timeout: 30000 });
        await this.waitForStableMenu(page);

        const extracted = await page.evaluate((S: any) => {
          const root = document.querySelector(S.MENU_ROOT);
          if (!root) return { groups: [] as any[] };

          const groups: any[] = [];
          for (const li of Array.from(root.querySelectorAll(S.GROUP_ITEM))) {
            const top = (li as Element).querySelector(S.GROUP_LINK);
            if (!top) continue;

            const label = (top.getAttribute('data-menu_category') || top.textContent || '')
              .trim()
              .replace(/\s+/g, ' ');
            if (!label) continue;

            const children: any[] = [];
            const submenu = (li as Element).querySelector(S.SUBMENU);
            if (submenu) {
              for (const a of Array.from(submenu.querySelectorAll(S.COLLECTION_LINK))) {
                const href = (a as Element).getAttribute('href') || '';
                const text = ((a as Element).textContent || '').trim().replace(/\s+/g, ' ');
                if (!text || !href.includes('/collections/')) continue;
                children.push({ title: text, href });
              }
            }

            groups.push({ label, href: top.getAttribute('href') || '', children });
          }
          return { groups };
        }, this.SELECTORS);

        const seenNav = new Set<string>();
        const seenCat = new Set<string>();

        for (const group of extracted.groups) {
          const navSlug = this.slugify(group.label);
          if (!navSlug || seenNav.has(navSlug)) continue;
          seenNav.add(navSlug);

          navigation.push({
            title: group.label,
            slug: navSlug,
            url: this.absoluteUrl(group.href) || this.siteRoot,
            hasChildren: group.children.length > 0,
          });

          for (const child of group.children) {
            const catSlug = this.extractSlugFromUrl(child.href);
            // A collection can be listed under more than one group; first occurrence wins.
            if (!catSlug || seenCat.has(catSlug)) continue;
            seenCat.add(catSlug);

            categories.push({
              title: child.title,
              slug: catSlug,
              url: this.absoluteUrl(child.href),
              parentSlug: navSlug,
              level: 1,
            });
          }
        }

        this.logger.log(
          `Extracted ${navigation.length} navigation headings and ${categories.length} categories`,
        );
      },

      failedRequestHandler: ({ request }: any, error: Error) => {
        scrapeError = error;
        this.logger.error(`Navigation request failed (${request.url}): ${error?.message}`);
      },
    });

    try {
      await crawler.run();
    } finally {
      await crawler.teardown().catch(() => undefined);
      await requestQueue.drop().catch(() => undefined);
    }

    // Fail loudly rather than returning an empty result the caller might cache as valid.
    if (navigation.length === 0) {
      const reason = scrapeError ? `: ${(scrapeError as Error).message}` : '';
      throw new Error(`Navigation scrape produced no results${reason}`);
    }

    return { navigation, categories };
  }

  /**
   * The mega-menu is injected progressively, so reading it as soon as the root element
   * exists can capture a partial tree (observed: 5 groups / 62 links instead of 6 / 113).
   * Poll until the link count stops growing before extracting.
   */
  private async waitForStableMenu(page: any, timeoutMs = 20000): Promise<void> {
    const started = Date.now();
    let previous = -1;
    let stableStreak = 0;

    while (Date.now() - started < timeoutMs) {
      const count = await page.evaluate((S: any) => {
        const root = document.querySelector(S.MENU_ROOT);
        if (!root) return 0;
        return root.querySelectorAll(S.COLLECTION_LINK).length;
      }, this.SELECTORS);

      if (count > 0 && count === previous) {
        stableStreak++;
        // Two consecutive identical readings — the menu has finished rendering.
        if (stableStreak >= 2) {
          this.logger.debug(`Menu stable at ${count} collection links`);
          return;
        }
      } else {
        stableStreak = 0;
      }

      previous = count;
      await this.delay(500);
    }

    this.logger.warn(`Menu did not stabilise within ${timeoutMs}ms; extracting what is present`);
  }

  private async acceptCookies(page: any): Promise<void> {
    try {
      await page.click(this.SELECTORS.COOKIE_ACCEPT, { timeout: 8000 });
      this.logger.debug('Cookie consent accepted');
      await this.delay(1000);
    } catch {
      // Banner absent (already dismissed, or not shown for this region) — safe to continue.
    }
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
