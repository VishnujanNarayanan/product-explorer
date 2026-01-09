import { Injectable } from '@nestjs/common';
import { PlaywrightCrawler } from 'crawlee';
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

@Injectable()
export class NavigationScraper extends BaseScraper {
  private readonly SELECTORS = {
    NAV_CONTAINER: 'nav',
    NAV_LIST: '.list-menu.list-menu--inline.hide-carets',
    NAV_ITEM: '.has-submenu',
    NAV_LINK: '.header__menu-item.list-menu__item.link.link--text.focus-inset',
    DROPDOWN: '.onstate-mega-menu__submenu',
    SUBCATEGORY_LINKS: '.onstate-mega-menu__submenu__links .list-menu .list-menu a',
  };

  async scrape(url: string): Promise<{ navigation: NavigationItem[]; categories: CategoryItem[] }> {
    const navigation: NavigationItem[] = [];
    const categories: CategoryItem[] = [];

    const crawler = new PlaywrightCrawler({
      maxRequestsPerCrawl: 50,
      maxConcurrency: 1,
      requestHandlerTimeoutSecs: 60,
      
      failedRequestHandler: async ({ request, error }) => {
        this.logger.error(`Request ${request.url} failed: ${(error as Error).message}`);
      },
      
      launchContext: {
        launchOptions: {
          headless: true,
        },
      },
      
      useSessionPool: true,
      persistCookiesPerSession: true,
      maxRequestRetries: this.MAX_RETRIES,
      retryOnBlocked: true,
      
      requestHandler: async ({ page, request }) => {
        this.logger.log(`Scraping navigation from: ${request.url}`);
        
        await page.waitForSelector(this.SELECTORS.NAV_CONTAINER);
        await this.delay(2000); // Be extra polite on homepage

        // Get main navigation items
        const navItems = await page.$$(this.SELECTORS.NAV_ITEM);
        
        for (const item of navItems) {
          try {
            const link = await item.$(this.SELECTORS.NAV_LINK);
            if (!link) continue;

            const title = await link.textContent();
            const href = await link.getAttribute('href');
            
            if (!title || !href) continue;

            const slug = this.extractSlugFromUrl(href);
            const fullUrl = href.startsWith('http') ? href : `https://www.worldofbooks.com${href}`;

            navigation.push({
              title: title.trim(),
              slug,
              url: fullUrl,
              hasChildren: true, // All .has-submenu items have dropdowns
            });

            // Hover to reveal dropdown
            await item.hover();
            await this.delay(1000); // Wait for dropdown animation

            // Check for dropdown
            const dropdown = await page.$(this.SELECTORS.DROPDOWN);
            if (dropdown) {
              const subcategoryLinks = await dropdown.$$(this.SELECTORS.SUBCATEGORY_LINKS);
              
              for (const subLink of subcategoryLinks) {
                const subTitle = await subLink.textContent();
                const subHref = await subLink.getAttribute('href');
                
                if (subTitle?.trim() && subHref && !subHref.includes('pages')) {
                  const subSlug = this.extractSlugFromUrl(subHref);
                  const subFullUrl = subHref.startsWith('http') ? subHref : `https://www.worldofbooks.com${subHref}`;
                  
                  categories.push({
                    title: subTitle.trim(),
                    slug: subSlug,
                    url: subFullUrl,
                    parentSlug: slug,
                    level: 1,
                  });
                }
              }
            }

            // Move mouse away to close dropdown
            await page.mouse.move(0, 0);
            await this.delay(500);

          } catch (error) {
            this.logger.warn(`Failed to process navigation item: ${error.message}`);
          }
        }

        this.logger.log(`Found ${navigation.length} navigation items and ${categories.length} categories`);
      },
    });

    await crawler.run([url]);
    return { navigation, categories };
  }
}