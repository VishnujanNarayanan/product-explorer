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
    COOKIE_CONSENT: '#onetrust-consent-sdk, .onetrust-pc-dark-filter',
    COOKIE_ACCEPT: '#onetrust-accept-btn-handler, button[aria-label="Accept"]',
  };

  async scrape(url: string): Promise<{ navigation: NavigationItem[]; categories: CategoryItem[] }> {
    const navigation: NavigationItem[] = [];
    const categories: CategoryItem[] = [];

    // @ts-ignore - Type issues with Crawlee v3
    const crawler = new PlaywrightCrawler({
      maxRequestsPerCrawl: 10,
      maxConcurrency: 1,
      requestHandlerTimeoutSecs: 90,
      
      // @ts-ignore
      failedRequestHandler: async ({ request, error }) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`Request ${request.url} failed: ${errorMessage}`);
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
      
      // @ts-ignore - Main handler
      requestHandler: async ({ page, request }) => {
        this.logger.log(`Scraping navigation from: ${request.url}`);
        
        // 1. FIRST: Handle cookie consent BEFORE anything else
        await this.handleCookieConsent(page);
        
        // 2. Wait for main navigation (with reduced timeout)
        try {
          await page.waitForSelector(this.SELECTORS.NAV_LIST, { timeout: 10000 });
          this.logger.log('Found main navigation list');
        } catch (error: any) {
          this.logger.warn(`Navigation list not found, looking for alternative...`);
          const anyNav = await page.$('nav');
          if (anyNav) {
            this.logger.log('Found alternative navigation container');
          }
        }
        
        await this.delay(2000);
        
        // 3. Get main navigation items
        const navList = await page.$(this.SELECTORS.NAV_LIST);
        let navItems = [];
        
        if (navList) {
          navItems = await navList.$$(this.SELECTORS.NAV_ITEM);
          this.logger.log(`Found ${navItems.length} navigation items in main nav list`);
        } else {
          navItems = await page.$$(this.SELECTORS.NAV_ITEM);
          this.logger.log(`Found ${navItems.length} navigation items in page (fallback)`);
        }
        
        const itemsToProcess = navItems.slice(0, 5);
        
        for (const [index, item] of itemsToProcess.entries()) {
          try {
            this.logger.log(`Processing navigation item ${index + 1}/${itemsToProcess.length}`);
            
            let link = await item.$(this.SELECTORS.NAV_LINK);
            if (!link) {
              link = await item.$('a');
            }
            
            if (!link) {
              this.logger.debug('No link found in nav item, skipping');
              continue;
            }

            const title = await link.textContent();
            const href = await link.getAttribute('href');
            
            if (!title?.trim() || !href) {
              this.logger.debug(`Missing title or href: title="${title}", href="${href}"`);
              continue;
            }

            const slug = this.extractSlugFromUrl(href);
            const fullUrl = href.startsWith('http') ? href : `https://www.worldofbooks.com${href}`;

            navigation.push({
              title: title.trim(),
              slug,
              url: fullUrl,
              hasChildren: true,
            });

            this.logger.debug(`Added navigation: "${title.trim()}" -> ${slug}`);

            await this.tryGetDropdownWithoutHover(page, item, slug, categories);
            await this.delay(1000);

          } catch (error: any) {
            this.logger.warn(`Failed to process navigation item ${index + 1}: ${error.message}`);
          }
        }

        this.logger.log(`Found ${navigation.length} navigation items and ${categories.length} categories`);
        await this.extractCategoriesFromVisibleDropdowns(page, categories);
      },
    });

    try {
      await crawler.run([{ 
        url: url, 
        uniqueKey: 'homepage-navigation-v2',
        label: 'navigation',
        userData: { depth: 0 }
      }]);
      
      this.logger.log(`Scraping completed: ${navigation.length} nav, ${categories.length} cats`);
      return { navigation, categories };
    } catch (error: any) {
      this.logger.error(`Crawler failed: ${error.message}`);
      return { navigation, categories };
    }
  }

  /**
   * Handle cookie consent modal before scraping
   */
  private async handleCookieConsent(page: any): Promise<void> {
    try {
      const cookieConsent = await page.$(this.SELECTORS.COOKIE_CONSENT);
      if (cookieConsent) {
        this.logger.log('Cookie consent modal detected, attempting to accept...');
        
        const acceptButton = await page.$(this.SELECTORS.COOKIE_ACCEPT);
        if (acceptButton) {
          await acceptButton.click();
          this.logger.log('Clicked cookie accept button');
          await this.delay(2000);
        } else {
          // Alternative: try to close via JavaScript
          await page.evaluate(() => {
            const modal = document.querySelector('#onetrust-consent-sdk');
            if (modal) {
              const closeBtn = modal.querySelector('button[aria-label="Close"]') as HTMLButtonElement;
              if (closeBtn) closeBtn.click();
            }
          });
          this.logger.log('Attempted to close cookie modal via JS');
          await this.delay(2000);
        }
      }
    } catch (error: any) {
      this.logger.warn(`Could not handle cookie consent: ${error.message}`);
    }
  }

  /**
   * Try to get dropdown content WITHOUT hover (using JavaScript)
   */
  private async tryGetDropdownWithoutHover(
    page: any, 
    navItem: any, 
    parentSlug: string, 
    categories: CategoryItem[]
  ): Promise<void> {
    try {
      const dropdowns = await page.$$(this.SELECTORS.DROPDOWN);
      
      for (const dropdown of dropdowns) {
        const isVisible = await dropdown.evaluate((el: any) => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden';
        });
        
        if (isVisible) {
          await this.extractCategoriesFromDropdown(dropdown, parentSlug, categories);
        }
      }
      
      const hasDropdown = await navItem.evaluate((el: any) => {
        return el.classList.contains('has-submenu');
      });
      
      if (hasDropdown) {
        const navText = await navItem.textContent();
        this.logger.debug(`Item "${navText?.trim()}" has submenu class`);
        
        const allDropdowns = await page.$$('[class*="dropdown"], [class*="mega-menu"], [class*="submenu"]');
        for (const dropdown of allDropdowns) {
          const dropdownHtml = await dropdown.innerHTML();
          if (dropdownHtml.length > 100) {
            await this.extractCategoriesFromDropdown(dropdown, parentSlug, categories);
          }
        }
      }
      
    } catch (error: any) {
      this.logger.debug(`Could not get dropdown without hover: ${error.message}`);
    }
  }

  /**
   * Extract categories from a dropdown element
   */
  private async extractCategoriesFromDropdown(
    dropdown: any, 
    parentSlug: string, 
    categories: CategoryItem[]
  ): Promise<void> {
    try {
      const linkSelectors = [
        this.SELECTORS.SUBCATEGORY_LINKS,
        'a',
        '.list-menu a',
        '.header__menu-item',
        '[class*="menu"] a'
      ];
      
      for (const selector of linkSelectors) {
        const subLinks = await dropdown.$$(selector);
        if (subLinks.length > 0) {
          this.logger.debug(`Found ${subLinks.length} links with selector: ${selector}`);
          
          for (const subLink of subLinks.slice(0, 10)) {
            try {
              const subTitle = await subLink.textContent();
              const subHref = await subLink.getAttribute('href');
              
              if (subTitle?.trim() && subHref && !subHref.includes('pages')) {
                const subSlug = this.extractSlugFromUrl(subHref);
                const subFullUrl = subHref.startsWith('http') ? subHref : `https://www.worldofbooks.com${subHref}`;
                
                const exists = categories.some(cat => cat.slug === subSlug);
                if (!exists) {
                  categories.push({
                    title: subTitle.trim(),
                    slug: subSlug,
                    url: subFullUrl,
                    parentSlug: parentSlug,
                    level: 1,
                  });
                  
                  this.logger.debug(`Added category: "${subTitle.trim()}" (parent: ${parentSlug})`);
                }
              }
            } catch (error: any) {
              // Skip individual link errors
            }
          }
          break;
        }
      }
    } catch (error: any) {
      this.logger.warn(`Failed to extract from dropdown: ${error.message}`);
    }
  }

  /**
   * Extract categories from already visible dropdowns in page
   */
  private async extractCategoriesFromVisibleDropdowns(
    page: any, 
    categories: CategoryItem[]
  ): Promise<void> {
    try {
      const dropdowns = await page.$$(this.SELECTORS.DROPDOWN);
      
      for (const dropdown of dropdowns) {
        const isVisible = await dropdown.evaluate((el: any) => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0'
          );
        });
        
        if (isVisible) {
          this.logger.debug('Found visible dropdown, extracting links...');
          const links = await dropdown.$$('a');
          
          for (const link of links.slice(0, 20)) {
            const title = await link.textContent();
            const href = await link.getAttribute('href');
            
            if (title?.trim() && href && href.includes('/collections/')) {
              const slug = this.extractSlugFromUrl(href);
              const fullUrl = href.startsWith('http') ? href : `https://www.worldofbooks.com${href}`;
              
              categories.push({
                title: title.trim(),
                slug,
                url: fullUrl,
                level: 1,
              });
            }
          }
        }
      }
    } catch (error: any) {
      this.logger.warn(`Failed to extract from visible dropdowns: ${error.message}`);
    }
  }
}