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
    PRODUCT_GRID: '.plp-listing.product-grid-container',
    PRODUCT_CARD: '.main-product-card.card-wrapper.product-card-wrapper',
    PRODUCT_TITLE: '.card__heading.h5 a',
    PRODUCT_AUTHOR: '.author.truncate-author',
    PRODUCT_PRICE: '.price .price-item',
    PRODUCT_IMAGE: '.card__inner img',
    LOAD_MORE_BUTTON: '#custom-load-more',
    PRODUCT_COUNT: '.plp-listing__count span',
    COOKIE_CONSENT: '#onetrust-consent-sdk, .onetrust-pc-dark-filter',
    COOKIE_ACCEPT: '#onetrust-accept-btn-handler, button[aria-label="Accept"]',
  };

  async scrape(url: string, categorySlug: string): Promise<ProductPreview[]> {
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
        
        // 1. Handle cookie consent FIRST
        await this.handleCookieConsent(page);
        
        // 2. Wait for initial page load
        await page.waitForSelector(this.SELECTORS.PRODUCT_GRID, { timeout: 15000 });
        await this.delay(2000);
        
        let clickCount = 0;
        const MAX_CLICKS = 2; // Just 2 clicks = 40 + 40 = 80 products (enough for demo)
        let previousProductCount = 0;
        
        // 3. Extract initial products
        await this.extractProductsFromPage(page, categorySlug, products);
        this.logger.log(`Initial load: ${products.length} products`);
        
        while (clickCount < MAX_CLICKS) {
          try {
            // Check if "Load more" button exists
            const loadMoreButton = await page.$(this.SELECTORS.LOAD_MORE_BUTTON);
            
            if (!loadMoreButton) {
              this.logger.log('No "Load more" button found');
              break;
            }
            
            // Scroll a bit to make sure button is in view
            await page.evaluate(() => window.scrollBy(0, 300));
            await this.delay(1000);
            
            // Click using JavaScript to avoid Playwright click blocking
            this.logger.log(`Clicking "Load more" via JavaScript (click ${clickCount + 1}/${MAX_CLICKS})`);
            
            await page.evaluate((selector) => {
              const button = document.querySelector(selector);
              if (button) {
                (button as HTMLElement).click();
              }
            }, this.SELECTORS.LOAD_MORE_BUTTON);
            
            // Wait for new products (1-2 seconds as you mentioned)
            await this.delay(2000);
            
            // Check if new products loaded
            const currentProductCount = await page.$$eval(
              this.SELECTORS.PRODUCT_CARD,
              (elements: any[]) => elements.length
            );
            
            if (currentProductCount > previousProductCount) {
              this.logger.log(`New products loaded: ${currentProductCount} total (was ${previousProductCount})`);
              
              // Extract only NEW products (to avoid duplicates)
              const newProductElements = await page.$$(this.SELECTORS.PRODUCT_CARD);
              const startIndex = previousProductCount;
              
              for (let i = startIndex; i < newProductElements.length && products.length < 120; i++) {
                try {
                  const productEl = newProductElements[i];
                  const productData = await this.extractSingleProduct(productEl, categorySlug);
                  
                  if (productData && !products.some(p => p.source_id === productData.source_id)) {
                    products.push(productData);
                  }
                } catch (error: any) {
                  // Skip individual errors
                }
              }
              
              previousProductCount = currentProductCount;
              clickCount++;
              
              // Small delay between clicks
              await this.delay(1000);
            } else {
              this.logger.log('No new products detected after click');
              break;
            }
            
          } catch (error: any) {
            this.logger.warn(`Error during pagination: ${error.message}`);
            break;
          }
        }
        
        this.logger.log(`Final: Scraped ${products.length} products from category: ${categorySlug}`);
        
        // Log product count
        try {
          const countText = await page.$eval(this.SELECTORS.PRODUCT_COUNT, (el: any) => el.textContent);
          if (countText) {
            this.logger.log(`Page shows: ${countText.trim()}`);
          }
        } catch (error) {
          // Ignore if not found
        }
      },
    });

    await crawler.run([{ 
      url, 
      uniqueKey: `category-${categorySlug}-${Date.now()}`,
      label: 'category',
      userData: { categorySlug, maxProducts: 120 }
    }]);
    
    return products;
  }

  /**
   * Handle cookie consent modal
   */
  private async handleCookieConsent(page: any): Promise<void> {
    try {
      const cookieConsent = await page.$(this.SELECTORS.COOKIE_CONSENT);
      if (cookieConsent) {
        this.logger.log('Cookie consent modal detected, attempting to accept...');
        
        const acceptButton = await page.$(this.SELECTORS.COOKIE_ACCEPT);
        if (acceptButton) {
          // Use JavaScript click to avoid blocking
          await page.evaluate(() => {
            const button = document.querySelector('#onetrust-accept-btn-handler') as HTMLButtonElement;
            if (button) button.click();
          });
          this.logger.log('Accepted cookies via JavaScript');
          await this.delay(2000);
        }
      }
    } catch (error: any) {
      this.logger.warn(`Could not handle cookie consent: ${error.message}`);
    }
  }

  /**
   * Extract products from current page (initial load)
   */
  private async extractProductsFromPage(
    page: any, 
    categorySlug: string, 
    products: ProductPreview[]
  ): Promise<void> {
    const productElements = await page.$$(this.SELECTORS.PRODUCT_CARD);
    this.logger.debug(`Found ${productElements.length} product elements`);
    
    for (const productEl of productElements) {
      try {
        const productData = await this.extractSingleProduct(productEl, categorySlug);
        if (productData && !products.some(p => p.source_id === productData.source_id)) {
          products.push(productData);
        }
      } catch (error: any) {
        // Skip individual product errors
      }
    }
  }

  /**
   * Extract single product data
   */
  private async extractSingleProduct(
    productEl: any,
    categorySlug: string
  ): Promise<ProductPreview | null> {
    try {
      const titleElement = await productEl.$(this.SELECTORS.PRODUCT_TITLE);
      const authorElement = await productEl.$(this.SELECTORS.PRODUCT_AUTHOR);
      const priceElement = await productEl.$(this.SELECTORS.PRODUCT_PRICE);
      const imageElement = await productEl.$(this.SELECTORS.PRODUCT_IMAGE);

      const title = await titleElement?.textContent();
      const author = await authorElement?.textContent();
      const priceText = await priceElement?.textContent();
      const imageUrl = await imageElement?.getAttribute('src');
      const productUrl = await titleElement?.getAttribute('href');

      if (!title || !productUrl) {
        return null;
      }

      const sourceId = this.extractSourceId(productUrl);
      const fullProductUrl = productUrl.startsWith('http') ? productUrl : `https://www.worldofbooks.com${productUrl}`;
      const { amount: price, currency } = this.normalizePrice(priceText || '');

      return {
        source_id: sourceId,
        title: title.trim(),
        author: author?.trim() || 'Unknown',
        price,
        currency,
        image_url: imageUrl || '',
        source_url: fullProductUrl,
        category_slug: categorySlug,
      };
    } catch (error: any) {
      this.logger.debug(`Failed to extract product: ${error.message}`);
      return null;
    }
  }

  /**
   * Extract source ID from product URL
   */
  private extractSourceId(url: string): string {
    // Try to extract ISBN from URL
    const isbnMatch = url.match(/\d{10,13}/);
    if (isbnMatch) {
      return `WOB-ISBN-${isbnMatch[0]}`;
    }
    
    // Extract from URL path
    const urlParts = url.split('/').filter(part => part.length > 0);
    const lastPart = urlParts[urlParts.length - 1];
    
    if (lastPart && !['en-gb', 'collections', 'products'].includes(lastPart)) {
      return `WOB-${lastPart}`;
    }
    
    // Fallback hash
    return `WOB-${Buffer.from(url).toString('base64').substring(0, 20).replace(/[^a-zA-Z0-9]/g, '')}`;
  }
}