import { Injectable } from '@nestjs/common';
import { PlaywrightCrawler } from 'crawlee';
import { BaseScraper } from './base.scraper';

export interface ProductPreview {
  source_id: string;
  title: string;
  author: string;
  price: number;
  currency: string;
  image_url: string;
  source_url: string;
  category_slug: string;
}

@Injectable()
export class CategoryScraper extends BaseScraper {
  private readonly SELECTORS = {
    // More robust selectors
    PRODUCT_GRID: '.plp-listing, .product-grid, [class*="product-grid"]',
    PRODUCT_CARD: '.main-product-card, .product-card, [class*="product-card"]',
    PRODUCT_TITLE: '.card__heading a, .product-title a, h3 a, [class*="title"] a',
    PRODUCT_AUTHOR: '.author, .product-author, [class*="author"], .truncate-author',
    PRODUCT_PRICE: '.price-item, .money, .product-price, [class*="price"]',
    PRODUCT_IMAGE: 'img[src*="products"], .card__inner img, .product-image img',
    LOAD_MORE: '#custom-load-more, .load-more, button:has-text("Load More"), [aria-label*="load more"]',
    PRODUCT_COUNT: '.plp-listing__count, .product-count, .results-count',
  };

  async scrape(url: string, categorySlug: string, maxProducts: number = 100): Promise<ProductPreview[]> {
    const products: ProductPreview[] = [];

    // @ts-ignore - Type issues with Crawlee v3
    const crawler = new PlaywrightCrawler({
      maxRequestsPerCrawl: 50,
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
        this.logger.log(`Scraping category: ${categorySlug} from ${request.url}`);
        
        // Wait for product grid
        await page.waitForSelector(this.SELECTORS.PRODUCT_GRID, { timeout: 15000 });
        await this.delay(2000);
        
        let totalProducts = 0;
        const MAX_PAGES = 3; // Limit to 3 pages for demo
        
        // Extract products with pagination
        for (let pageNum = 1; pageNum <= MAX_PAGES && products.length < maxProducts; pageNum++) {
          try {
            this.logger.log(`Processing page ${pageNum} for ${categorySlug}`);
            
            // Extract current page products
            const pageProducts = await this.extractPageProducts(page, categorySlug);
            
            // Add new products
            for (const product of pageProducts) {
              if (!products.some(p => p.source_id === product.source_id)) {
                products.push(product);
                totalProducts++;
                
                if (totalProducts >= maxProducts) break;
              }
            }
            
            // Try to load next page if not reached limit
            if (totalProducts < maxProducts) {
              const hasMore = await this.loadNextPage(page);
              if (!hasMore) break;
              
              await this.delay(2000); // Wait for new products
            }
            
          } catch (error: any) {
            this.logger.warn(`Page ${pageNum} failed: ${error.message}`);
            break;
          }
        }
        
        this.logger.log(`Scraped ${products.length} products from ${categorySlug}`);
      },
    });

    await crawler.run([{ 
      url, 
      uniqueKey: `category-${categorySlug}-${Date.now()}`,
      label: 'category',
      userData: { categorySlug, maxProducts }
    }]);
    
    return products;
  }

  /**
   * Extract products from current page
   */
  private async extractPageProducts(page: any, categorySlug: string): Promise<ProductPreview[]> {
    const products: ProductPreview[] = [];
    
    const productElements = await page.$$(this.SELECTORS.PRODUCT_CARD);
    this.logger.debug(`Found ${productElements.length} products on page`);
    
    for (const productEl of productElements) {
      try {
        const product = await this.extractSingleProduct(productEl, categorySlug);
        if (product) products.push(product);
      } catch (error) {
        // Skip failed products
      }
    }
    
    return products;
  }

  /**
   * Extract single product
   */
  private async extractSingleProduct(
    productEl: any,
    categorySlug: string
  ): Promise<ProductPreview | null> {
    try {
      // Try multiple selector strategies
      const title = await this.extractText(productEl, [
        '.card__heading a',
        '.product-title',
        'h3 a',
        '[class*="title"]'
      ]);
      
      const author = await this.extractText(productEl, [
        '.author',
        '.product-author',
        '[class*="author"]'
      ]);
      
      const priceText = await this.extractText(productEl, [
        '.price-item',
        '.money',
        '.product-price'
      ]);
      
      const imageUrl = await this.extractAttribute(productEl, 'src', [
        'img[src*="products"]',
        '.card__inner img',
        '.product-image img',
        'img'
      ]);
      
      const productUrl = await this.extractAttribute(productEl, 'href', [
        '.card__heading a',
        '.product-title a',
        'a[href*="/products/"]'
      ]);
      
      if (!title || !productUrl) return null;
      
      const sourceId = this.extractSourceId(productUrl);
      const fullUrl = productUrl.startsWith('http') ? productUrl : `https://www.worldofbooks.com${productUrl}`;
      const { amount: price, currency } = this.normalizePrice(priceText || '');
      
      return {
        source_id: sourceId,
        title: title.trim(),
        author: author?.trim() || 'Unknown',
        price,
        currency: currency || 'GBP',
        image_url: imageUrl || '',
        source_url: fullUrl,
        category_slug: categorySlug,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Try multiple selectors for text extraction
   */
  private async extractText(element: any, selectors: string[]): Promise<string | null> {
    for (const selector of selectors) {
      try {
        const el = await element.$(selector);
        if (el) {
          const text = await el.textContent();
          if (text?.trim()) return text.trim();
        }
      } catch (error) {
        continue;
      }
    }
    return null;
  }

  /**
   * Try multiple selectors for attribute extraction
   */
  private async extractAttribute(element: any, attribute: string, selectors: string[]): Promise<string | null> {
    for (const selector of selectors) {
      try {
        const el = await element.$(selector);
        if (el) {
          const value = await el.getAttribute(attribute);
          if (value) return value;
        }
      } catch (error) {
        continue;
      }
    }
    return null;
  }

  /**
   * Load next page of products
   */
  private async loadNextPage(page: any): Promise<boolean> {
    try {
      // Try multiple load more button selectors
      const loadMoreSelectors = [
        '#custom-load-more',
        '.load-more',
        'button:has-text("Load More")',
        '[aria-label*="load more"]'
      ];
      
      for (const selector of loadMoreSelectors) {
        const button = await page.$(selector);
        if (button) {
          await button.scrollIntoViewIfNeeded();
          await this.delay(500);
          
          // Click via JavaScript to avoid blocking
          await page.evaluate((sel) => {
            const btn = document.querySelector(sel);
            if (btn) (btn as HTMLElement).click();
          }, selector);
          
          this.logger.debug(`Clicked load more: ${selector}`);
          return true;
        }
      }
      
      // Check for pagination links
      const nextLink = await page.$('a[rel="next"], .pagination__next, a:has-text("Next")');
      if (nextLink) {
        await nextLink.click();
        this.logger.debug('Clicked next page link');
        return true;
      }
      
    } catch (error) {
      this.logger.debug('No more pages or failed to load next page');
    }
    
    return false;
  }

  /**
   * Improved source ID generation
   */
  private extractSourceId(url: string): string {
    // Extract ISBN
    const isbnMatch = url.match(/\b\d{10,13}\b/);
    if (isbnMatch) return `WOB-ISBN-${isbnMatch[0]}`;
    
    // Extract from URL path
    const urlObj = new URL(url.startsWith('http') ? url : `https://www.worldofbooks.com${url}`);
    const pathParts = urlObj.pathname.split('/').filter(p => p);
    
    // Get product slug (last non-empty part)
    for (let i = pathParts.length - 1; i >= 0; i--) {
      if (pathParts[i] && 
          !['en-gb', 'collections', 'products', 'pages'].includes(pathParts[i]) &&
          pathParts[i].length > 3) {
        return `WOB-${pathParts[i]}`;
      }
    }
    
    // Fallback: hash of URL
    return `WOB-${Buffer.from(url).toString('base64').substring(0, 15).replace(/[^a-zA-Z0-9]/g, '')}`;
  }
}