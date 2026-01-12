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
  async scrape(url: string): Promise<{ navigation: NavigationItem[]; categories: CategoryItem[] }> {
    const navigation: NavigationItem[] = [];
    const categories: CategoryItem[] = [];

    const crawler = new (PlaywrightCrawler as any)({
      maxRequestsPerCrawl: 1,
      maxConcurrency: 1,
      
      requestHandler: async ({ page, request }: any) => {
        this.logger.log(`Scraping navigation from: ${request.url}`);
        
        // 1. Handle cookie consent
        await this.handleCookieConsent(page);
        await page.waitForLoadState('networkidle');
        await this.delay(2000);
        
        // 2. GET THE 8 MAIN NAVIGATION ITEMS (always the same)
        const mainNavItems = [
          { title: 'Clearance', slug: 'clearance', hasChildren: false },
          { title: 'eGift Cards', slug: 'egift-cards', hasChildren: false },
          { title: 'Fiction Books', slug: 'fiction-books', hasChildren: true },
          { title: 'Non-Fiction Books', slug: 'non-fiction-books', hasChildren: true },
          { title: 'Children\'s Books', slug: 'childrens-books', hasChildren: true },
          { title: 'Rare Books', slug: 'rare-books', hasChildren: true },
          { title: 'Music & Film', slug: 'music-film', hasChildren: true },
          { title: 'Sell Your Books', slug: 'sell-your-books', hasChildren: false }
        ];
        
        for (const item of mainNavItems) {
          navigation.push({
            ...item,
            url: this.getUrlForNavItem(item.title, item.slug)
          });
        }
        
        this.logger.log(`Added ${navigation.length} main navigation items`);
        
        // 3. EXTRACT CATEGORIES USING data-menu_category ATTRIBUTES
        // This is the KEY FIX - using the data attributes you found!
        const categoryData = await page.$$eval('a[data-menu_category]', 
          (links: HTMLAnchorElement[]) => links.map(link => ({
            navTitle: link.getAttribute('data-menu_category'),
            categoryTitle: link.getAttribute('data-menu_subcategory'),
            href: link.href,
            text: link.textContent?.trim()
          }))
        );
        
        this.logger.log(`Found ${categoryData.length} category links with data attributes`);
        
        // 4. PROCESS AND ORGANIZE CATEGORIES
        const processedSlugs = new Set<string>();
        
        for (const data of categoryData) {
          if (!data.navTitle || !data.categoryTitle || !data.href) continue;
          
          // Find matching navigation item
          const matchingNav = navigation.find(nav => 
            data.navTitle.includes(nav.title) || 
            nav.title.includes(data.navTitle)
          );
          
          if (!matchingNav) {
            this.logger.debug(`No matching nav for: "${data.navTitle}"`);
            continue;
          }
          
          // Extract slug from URL
          const slug = this.extractSlugFromUrl(data.href);
          
          // Skip duplicates
          if (processedSlugs.has(slug)) continue;
          
          // Add category
          categories.push({
            title: data.categoryTitle,
            slug,
            url: data.href,
            parentSlug: matchingNav.slug,
            level: 1
          });
          
          processedSlugs.add(slug);
          this.logger.debug(`Added: "${data.categoryTitle}" → ${matchingNav.title}`);
        }
        
        // 5. LOG RESULTS
        const categoriesByNav: Record<string, number> = {};
        categories.forEach(cat => {
          if (cat.parentSlug) {
            const navTitle = navigation.find(n => n.slug === cat.parentSlug)?.title || 'unknown';
            categoriesByNav[navTitle] = (categoriesByNav[navTitle] || 0) + 1;
          }
        });
        
        this.logger.log(`Extracted ${categories.length} total categories`);
        Object.entries(categoriesByNav).forEach(([nav, count]) => {
          this.logger.log(`  ${nav}: ${count} categories`);
        });
      },
    });

    try {
      await crawler.run([{ 
        url: url, 
        uniqueKey: 'nav-data-attributes-v1',
        label: 'navigation',
      }]);
      
      return { navigation, categories };
      
    } catch (error: any) {
      this.logger.error(`Scraper failed: ${error.message}`);
      return { navigation: [], categories: [] };
    }
  }

  private getUrlForNavItem(title: string, slug: string): string {
    const baseUrl = 'https://www.worldofbooks.com/en-gb';
    const urlMap: Record<string, string> = {
      'Clearance': `${baseUrl}/pages/clearance`,
      'eGift Cards': `${baseUrl}/pages/Gift-cards`,
      'Fiction Books': `${baseUrl}/pages/fiction`,
      'Non-Fiction Books': `${baseUrl}/pages/non-fiction`,
      'Children\'s Books': `${baseUrl}/pages/childrens`,
      'Rare Books': `${baseUrl}/collections/rarebooks`,
      'Music & Film': `${baseUrl}/pages/music-film`,
      'Sell Your Books': 'https://ziffit.onelink.me/mXLK/wobuk'
    };
    return urlMap[title] || `${baseUrl}/pages/${slug}`;
  }

  private async handleCookieConsent(page: any): Promise<void> {
    try {
      const cookieConsent = await page.$('#onetrust-consent-sdk, .onetrust-pc-dark-filter');
      if (cookieConsent) {
        this.logger.log('Accepting cookie consent...');
        const acceptButton = await page.$('#onetrust-accept-btn-handler, button[aria-label="Accept"]');
        if (acceptButton) {
          await acceptButton.click();
          await this.delay(2000);
        }
      }
    } catch (error: any) {
      this.logger.warn(`Cookie consent failed: ${error.message}`);
    }
  }
}