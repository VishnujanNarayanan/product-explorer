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
    // Top navigation selectors
    TOP_NAV_LINKS: '.header__menu-item, nav a, header a, [class*="header__menu"] a',
    
    // Dropdown/mega-menu selectors
    DROPDOWN: '.header__submenu, .mega-menu, [class*="dropdown"], [class*="submenu"]',
    DROPDOWN_CATEGORY_LINKS: 'a[href*="/collections/"]',
    
    // Cookie consent
    COOKIE_CONSENT: '#onetrust-consent-sdk, .onetrust-pc-dark-filter',
    COOKIE_ACCEPT: '#onetrust-accept-btn-handler, button[aria-label="Accept"]',
  };

  async scrape(url: string): Promise<{ navigation: NavigationItem[]; categories: CategoryItem[] }> {
    const navigation: NavigationItem[] = [];
    const categories: CategoryItem[] = [];

    // @ts-ignore - Type issues with Crawlee v3
    const crawler = new PlaywrightCrawler({
      maxRequestsPerCrawl: 20,
      maxConcurrency: 1,
      requestHandlerTimeoutSecs: 120,
      
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
        
        // 1. Handle cookie consent
        await this.handleCookieConsent(page);
        
        // 2. Wait for page to load
        await page.waitForLoadState('networkidle');
        await this.delay(3000);
        
        // 3. Extract ALL navigation links
        await this.extractAllNavigationLinks(page, navigation);
        
        // 4. Extract categories from already found links (NEW!)
        this.extractCategoriesFromNavigationLinks(navigation, categories);
        
        // 5. Fix the navigation items (correct titles and hasChildren)
        this.fixNavigationItems(navigation);
        
        // 6. Get only the 8 main items
        const mainNavItems = this.getMainNavigationItems(navigation);
        this.logger.log(`Processing ${mainNavItems.length} main navigation items`);
        
        // 7. Extract dropdown categories for items that should have children
        for (const [index, navItem] of mainNavItems.entries()) {
          try {
            this.logger.log(`Processing dropdown for: "${navItem.title}" (${index + 1}/${mainNavItems.length})`);
            
            if (navItem.hasChildren) {
              // Try to extract more categories via hover/click
              await this.tryExtractDropdownCategories(page, navItem, categories);
            }
            
            await this.delay(500); // Respectful delay
          } catch (error: any) {
            this.logger.warn(`Failed dropdown for "${navItem.title}": ${error.message}`);
          }
        }
        
        this.logger.log(`Completed: ${mainNavItems.length} main nav, ${categories.length} categories`);
      },
    });

    try {
      await crawler.run([{ 
        url: url, 
        uniqueKey: 'homepage-navigation-final-fixed-v2',
        label: 'navigation',
        userData: { depth: 0 }
      }]);
      
      // Get the final main navigation items
      const mainNavItems = this.getMainNavigationItems(navigation);
      
      // Clean up categories - remove any that don't have proper parent slugs
      const cleanedCategories = this.cleanCategories(categories, mainNavItems);
      
      this.logger.log(`Final: ${mainNavItems.length} navigation, ${cleanedCategories.length} categories`);
      return { navigation: mainNavItems, categories: cleanedCategories };
      
    } catch (error: any) {
      this.logger.error(`Crawler failed: ${error.message}`);
      return { navigation: [], categories: [] };
    }
  }

  /**
   * Extract all navigation links
   */
  private async extractAllNavigationLinks(page: any, navigation: NavigationItem[]): Promise<void> {
    try {
      // Get all header links
      const headerLinks = await page.$$eval(this.SELECTORS.TOP_NAV_LINKS, 
        (links: HTMLAnchorElement[]) => links.map(link => ({
          text: link.textContent?.trim(),
          href: link.href,
          class: link.className,
          parentClass: link.parentElement?.className || ''
        }))
      );
      
      const processedUrls = new Set<string>();
      
      for (const linkData of headerLinks) {
        if (linkData.text && linkData.href && !processedUrls.has(linkData.href)) {
          navigation.push({
            title: linkData.text,
            slug: this.extractSlugFromUrl(linkData.href),
            url: linkData.href,
            hasChildren: linkData.parentClass.includes('has-submenu') || 
                        linkData.parentClass.includes('dropdown')
          });
          
          processedUrls.add(linkData.href);
          this.logger.debug(`Added: "${linkData.text}"`);
        }
      }
      
      this.logger.log(`Found ${navigation.length} navigation links`);
      
    } catch (error: any) {
      this.logger.warn(`Failed to extract navigation links: ${error.message}`);
    }
  }

  /**
   * Extract categories from already found navigation links
   */
  private extractCategoriesFromNavigationLinks(
    navigation: NavigationItem[], 
    categories: CategoryItem[]
  ): void {
    // Map of parent navigation items to their slugs
    const parentMapping = [
      { parentTitle: 'Fiction Books', parentSlug: 'fiction-books', childKeywords: ['Crime & Mystery', 'Fantasy', 'Romance', 'Science Fiction', 'Horror', 'Thriller', 'Adventure', 'Classic'] },
      { parentTitle: 'Non-Fiction Books', parentSlug: 'non-fiction-books', childKeywords: ['Biography', 'Health', 'Arts', 'Science', 'Technology', 'History', 'Business', 'Cookery'] },
      { parentTitle: 'Children\'s Books', parentSlug: 'childrens', childKeywords: ['Baby', 'Toddler', 'Ages', 'Teenage', 'YA', 'Children\'s', 'Kids', 'Picture Books'] },
      { parentTitle: 'Rare Books', parentSlug: 'rarebooks', childKeywords: ['Rare', 'Antiques', 'Collectables', 'Heritage', 'Ephemera'] },
      { parentTitle: 'Music & Film', parentSlug: 'music-film', childKeywords: ['Music', 'DVD', 'Blu-Ray', 'Film', 'Video Games', 'Blues', 'Jazz', 'Rock'] },
    ];
    
    for (const navItem of navigation) {
      // Skip if this is a main navigation item
      const isMainNav = [
        'Clearance', 'eGift Cards', 'Fiction Books', 'Non-Fiction Books',
        'Children\'s Books', 'Rare Books', 'Music & Film', 'Sell Your Books'
      ].some(mainNav => navItem.title.includes(mainNav) || mainNav.includes(navItem.title));
      
      if (isMainNav) continue;
      
      // Try to find parent for this category
      for (const parent of parentMapping) {
        const isChild = parent.childKeywords.some(keyword => 
          navItem.title.includes(keyword) || keyword.includes(navItem.title)
        );
        
        if (isChild && navItem.url.includes('/collections/')) {
          const exists = categories.some(cat => cat.slug === navItem.slug);
          
          if (!exists) {
            categories.push({
              title: navItem.title,
              slug: navItem.slug,
              url: navItem.url,
              parentSlug: parent.parentSlug,
              level: 1
            });
            
            this.logger.debug(`Extracted category: "${navItem.title}" → parent: ${parent.parentSlug}`);
          }
          break;
        }
      }
    }
    
    this.logger.log(`Extracted ${categories.length} categories from navigation links`);
  }

  /**
   * Fix navigation items - correct titles and hasChildren
   */
  private fixNavigationItems(navigation: NavigationItem[]): void {
    // Map of corrections
    const corrections: Record<string, { title: string; hasChildren: boolean }> = {
      // Fix wrong titles
      'All Fiction Books': { title: 'Fiction Books', hasChildren: true },
      'All Non-Fiction Books': { title: 'Non-Fiction Books', hasChildren: true },
      'Children\'s Books': { title: 'Children\'s Books', hasChildren: true },
      
      // Items that should NOT have children
      'Clearance': { title: 'Clearance', hasChildren: false },
      'eGift Cards': { title: 'eGift Cards', hasChildren: false },
      'Sell Your Books': { title: 'Sell Your Books', hasChildren: false },
      
      // Items that SHOULD have children
      'Rare Books': { title: 'Rare Books', hasChildren: true },
      'Music & Film': { title: 'Music & Film', hasChildren: true },
    };
    
    // Also fix URLs for specific items
    const urlCorrections: Record<string, string> = {
      'Fiction Books': 'https://www.worldofbooks.com/en-gb/pages/fiction',
      'Non-Fiction Books': 'https://www.worldofbooks.com/en-gb/pages/non-fiction',
      'Children\'s Books': 'https://www.worldofbooks.com/en-gb/pages/childrens',
    };
    
    for (const navItem of navigation) {
      // Apply title and hasChildren corrections
      if (corrections[navItem.title]) {
        const correction = corrections[navItem.title];
        navItem.title = correction.title;
        navItem.hasChildren = correction.hasChildren;
        this.logger.debug(`Corrected: "${navItem.title}" -> hasChildren: ${navItem.hasChildren}`);
      }
      
      // Apply URL corrections
      if (urlCorrections[navItem.title]) {
        navItem.url = urlCorrections[navItem.title];
        this.logger.debug(`Fixed URL for "${navItem.title}": ${navItem.url}`);
      }
    }
  }

  /**
   * Get the 8 main navigation items with proper filtering
   */
  private getMainNavigationItems(navigation: NavigationItem[]): NavigationItem[] {
    // The exact 8 items we want
    const expectedTitles = [
      'Clearance',
      'eGift Cards', 
      'Fiction Books',
      'Non-Fiction Books',
      'Children\'s Books',
      'Rare Books',
      'Music & Film',
      'Sell Your Books'
    ];
    
    const mainItems: NavigationItem[] = [];
    
    // First: Try to find exact title matches
    for (const expected of expectedTitles) {
      let found = navigation.find(nav => 
        nav.title === expected
      );
      
      // If not found by exact title, try to find the best match
      if (!found) {
        found = navigation.find(nav => {
          const lowerTitle = nav.title.toLowerCase();
          const lowerExpected = expected.toLowerCase();
          
          // Match but filter out wrong items
          const isMatch = lowerTitle.includes(lowerExpected);
          const isWrongMatch = 
            lowerTitle.startsWith('all ') || // Exclude "All Fiction Books"
            (lowerTitle.includes('children') && nav.url.includes('rare')); // Exclude rare children's
          
          return isMatch && !isWrongMatch;
        });
      }
      
      if (found && !mainItems.some(item => item.slug === found!.slug)) {
        mainItems.push(found);
      }
    }
    
    // If we're still missing items, create them
    const missingItems = expectedTitles.filter(expected => 
      !mainItems.some(item => item.title === expected)
    );
    
    for (const missing of missingItems) {
      this.logger.warn(`Creating missing item: ${missing}`);
      
      // Create the missing item with default values
      const newItem: NavigationItem = {
        title: missing,
        slug: missing.toLowerCase().replace(/\s+/g, '-'),
        url: this.getDefaultUrlForItem(missing),
        hasChildren: this.shouldHaveChildren(missing)
      };
      
      mainItems.push(newItem);
    }
    
    // Sort to match expected order
    mainItems.sort((a, b) => {
      return expectedTitles.indexOf(a.title) - expectedTitles.indexOf(b.title);
    });
    
    this.logger.log(`Selected ${mainItems.length} main navigation items`);
    return mainItems;
  }

  /**
   * Get default URL for a missing item
   */
  private getDefaultUrlForItem(title: string): string {
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
    
    return urlMap[title] || `${baseUrl}/pages/${title.toLowerCase().replace(/\s+/g, '-')}`;
  }

  /**
   * Determine if an item should have children
   */
  private shouldHaveChildren(title: string): boolean {
    const itemsWithoutChildren = ['Clearance', 'eGift Cards', 'Sell Your Books'];
    return !itemsWithoutChildren.includes(title);
  }

  /**
   * Try to extract dropdown categories via hover/click
   */
  private async tryExtractDropdownCategories(
    page: any, 
    navItem: NavigationItem, 
    categories: CategoryItem[]
  ): Promise<void> {
    try {
      // Find the nav item element with better text matching
      const navElement = await this.findNavElementWithFallback(page, navItem.title);
      if (!navElement) {
        this.logger.debug(`Could not find element for: "${navItem.title}"`);
        return;
      }
      
      // Try hover first
      try {
        await navElement.hover();
        await this.delay(1500);
        
        // Check for visible dropdown
        const dropdown = await page.$(this.SELECTORS.DROPDOWN);
        if (dropdown) {
          const isVisible = await dropdown.evaluate((el: any) => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden';
          });
          
          if (isVisible) {
            await this.extractFromDropdown(page, dropdown, navItem, categories);
            return;
          }
        }
      } catch (hoverError) {
        this.logger.debug(`Hover failed for "${navItem.title}": ${hoverError.message}`);
      }
      
      // Try click if hover didn't work
      try {
        await navElement.click();
        await this.delay(1500);
        
        // Check if we got a dropdown or navigated
        const currentUrl = await page.url();
        if (currentUrl !== navItem.url) {
          // We navigated - try to extract from this page
          await this.extractCategoriesFromCurrentPage(page, navItem, categories);
          await page.goBack();
          await this.delay(1000);
        }
      } catch (clickError) {
        this.logger.debug(`Click failed for "${navItem.title}": ${clickError.message}`);
      }
      
    } catch (error: any) {
      this.logger.debug(`Dropdown extraction failed for "${navItem.title}": ${error.message}`);
    }
  }

  /**
   * Find navigation element with fallback to original text
   */
  private async findNavElementWithFallback(page: any, correctedText: string): Promise<any> {
    // Map corrected titles to possible original texts
    const originalTextMap: Record<string, string[]> = {
      'Fiction Books': ['All Fiction Books', 'Fiction', 'Fiction Books'],
      'Non-Fiction Books': ['All Non-Fiction Books', 'Non-Fiction', 'Non-Fiction Books'],
      'Children\'s Books': ['Children\'s Books', 'Children', 'Kids Books'],
      'Rare Books': ['Rare Books', 'Rare'],
      'Music & Film': ['Music & Film', 'Music', 'Film'],
    };
    
    const possibleTexts = originalTextMap[correctedText] || [correctedText];
    
    for (const text of possibleTexts) {
      try {
        const xpath = `//a[contains(text(), "${text}")]`;
        const elements = await page.$x(xpath);
        if (elements.length > 0) {
          this.logger.debug(`Found element for "${correctedText}" using text: "${text}"`);
          return elements[0];
        }
      } catch (error) {
        continue;
      }
    }
    
    return null;
  }

  /**
   * Extract categories from a visible dropdown
   */
  private async extractFromDropdown(
    page: any, 
    dropdown: any, 
    navItem: NavigationItem, 
    categories: CategoryItem[]
  ): Promise<void> {
    try {
      const links = await dropdown.$$('a');
      let extractedCount = 0;
      
      for (const link of links) {
        try {
          const title = await link.textContent();
          const href = await link.getAttribute('href');
          
          if (title?.trim() && href && href.includes('/collections/')) {
            const slug = this.extractSlugFromUrl(href);
            const exists = categories.some(cat => cat.slug === slug);
            
            if (!exists) {
              categories.push({
                title: title.trim(),
                slug,
                url: href.startsWith('http') ? href : `https://www.worldofbooks.com${href}`,
                parentSlug: navItem.slug,
                level: 1
              });
              extractedCount++;
            }
          }
        } catch (error) {
          // Skip individual link errors
        }
      }
      
      if (extractedCount > 0) {
        this.logger.debug(`Extracted ${extractedCount} categories from "${navItem.title}" dropdown`);
      }
      
    } catch (error: any) {
      this.logger.debug(`Failed to extract from dropdown: ${error.message}`);
    }
  }

  /**
   * Extract categories from current page (if we navigated)
   */
  private async extractCategoriesFromCurrentPage(
    page: any, 
    navItem: NavigationItem, 
    categories: CategoryItem[]
  ): Promise<void> {
    try {
      const links = await page.$$eval('a[href*="/collections/"]', 
        (links: HTMLAnchorElement[]) => links.map(link => ({
          text: link.textContent?.trim(),
          href: link.href
        }))
      );
      
      for (const link of links) {
        if (link.text && link.text.length > 2) {
          const slug = this.extractSlugFromUrl(link.href);
          const exists = categories.some(cat => cat.slug === slug);
          
          if (!exists) {
            categories.push({
              title: link.text,
              slug,
              url: link.href,
              parentSlug: navItem.slug,
              level: 1
            });
          }
        }
      }
      
      this.logger.debug(`Extracted ${links.length} categories from "${navItem.title}" page`);
      
    } catch (error: any) {
      this.logger.debug(`Failed to extract from page: ${error.message}`);
    }
  }

  /**
   * Clean up categories - remove duplicates and fix parent slugs
   */
  private cleanCategories(categories: CategoryItem[], navigation: NavigationItem[]): CategoryItem[] {
    const cleaned: CategoryItem[] = [];
    const seenSlugs = new Set<string>();
    
    // Create a map of navigation slugs
    const navSlugMap: Record<string, string> = {};
    for (const nav of navigation) {
      navSlugMap[nav.title.toLowerCase()] = nav.slug;
    }
    
    for (const category of categories) {
      // Skip duplicates
      if (seenSlugs.has(category.slug)) continue;
      
      // Fix parent slug if needed
      if (!category.parentSlug) {
        // Try to find parent based on title
        for (const [parentTitle, parentSlug] of Object.entries(navSlugMap)) {
          if (category.title.toLowerCase().includes(parentTitle) || 
              parentTitle.includes(category.title.toLowerCase())) {
            category.parentSlug = parentSlug;
            break;
          }
        }
      }
      
      // Only add if we have a parent slug
      if (category.parentSlug) {
        cleaned.push(category);
        seenSlugs.add(category.slug);
      }
    }
    
    return cleaned;
  }

  /**
   * Handle cookie consent
   */
  private async handleCookieConsent(page: any): Promise<void> {
    try {
      const cookieConsent = await page.$(this.SELECTORS.COOKIE_CONSENT);
      if (cookieConsent) {
        this.logger.log('Cookie consent detected, accepting...');
        
        const acceptButton = await page.$(this.SELECTORS.COOKIE_ACCEPT);
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