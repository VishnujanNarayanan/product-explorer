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
    // CORRECT selectors for World of Books
    PRODUCT_GRID: '.plp-listing',
    PRODUCT_CARD: '.main-product-card',
    PRODUCT_TITLE: '.card__heading a',
    PRODUCT_AUTHOR: '.truncate-author',
    PRODUCT_PRICE: '.price-item',
    PRODUCT_IMAGE: '.card__media img',
    LOAD_MORE: '#custom-load-more',
  };

  async scrape(url: string, categorySlug: string, maxProducts: number = 100): Promise<ProductPreview[]> {
    const products: ProductPreview[] = [];

    const crawler = new (PlaywrightCrawler as any)({
      maxRequestsPerCrawl: 50,
      maxConcurrency: 1,
      
      requestHandler: async ({ page, request }: any) => {
        this.logger.log(`Scraping category: ${categorySlug} from ${request.url}`);
        
        // Wait for product grid
        await page.waitForSelector(this.SELECTORS.PRODUCT_GRID, { timeout: 15000 });
        await this.delay(2000);
        
        let totalProducts = 0;
        const MAX_LOAD_MORE_CLICKS = 5; // Limit clicks for demo
        
        // Click "Load More" multiple times
        for (let clickCount = 0; clickCount < MAX_LOAD_MORE_CLICKS; clickCount++) {
          try {
            this.logger.log(`Extracting page ${clickCount + 1} for ${categorySlug}`);
            
            // Extract current products
            const pageProducts = await this.extractPageProducts(page, categorySlug);
            
            // Add new products
            for (const product of pageProducts) {
              if (!products.some(p => p.source_id === product.source_id)) {
                products.push(product);
                totalProducts++;
                
                if (totalProducts >= maxProducts) {
                  this.logger.log(`Reached max products (${maxProducts})`);
                  return;
                }
              }
            }
            
            // Try to click "Load More"
            const hasMore = await this.clickLoadMore(page);
            if (!hasMore) {
              this.logger.log('No more products to load');
              break;
            }
            
            await this.delay(3000); // Wait for new products to load
            
          } catch (error: any) {
            this.logger.warn(`Page ${clickCount + 1} failed: ${error.message}`);
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
    this.logger.debug(`Found ${productElements.length} product cards on page`);
    
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
      // Title
      const titleEl = await productEl.$(this.SELECTORS.PRODUCT_TITLE);
      if (!titleEl) return null;
      
      const title = await titleEl.textContent();
      const productUrl = await titleEl.getAttribute('href');
      
      if (!title || !productUrl) return null;
      
      // Author
      const authorEl = await productEl.$(this.SELECTORS.PRODUCT_AUTHOR);
      const author = authorEl ? await authorEl.textContent() : 'Unknown';
      
      // Price
      const priceEl = await productEl.$(this.SELECTORS.PRODUCT_PRICE);
      const priceText = priceEl ? await priceEl.textContent() : '';
      const { amount: price, currency } = this.normalizePrice(priceText || '');
      
      // Image
      const imageEl = await productEl.$(this.SELECTORS.PRODUCT_IMAGE);
      const imageUrl = imageEl ? await imageEl.getAttribute('src') : '';
      
      // Source ID
      const sourceId = this.extractSourceId(productUrl);
      const fullUrl = productUrl.startsWith('http') ? productUrl : `https://www.worldofbooks.com${productUrl}`;
      
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
   * Click Load More button
   */
  private async clickLoadMore(page: any): Promise<boolean> {
    try {
      const loadMoreBtn = await page.$(this.SELECTORS.LOAD_MORE);
      if (!loadMoreBtn) {
        this.logger.debug('Load More button not found');
        return false;
      }
      
      // Check if button is visible and enabled
      const isVisible = await loadMoreBtn.evaluate((el: any) => {
        return el.offsetParent !== null && !el.disabled;
      });
      
      if (!isVisible) {
        this.logger.debug('Load More button not visible or disabled');
        return false;
      }
      
      // Scroll to button
      await loadMoreBtn.scrollIntoViewIfNeeded();
      await this.delay(500);
      
      // Click via JavaScript to avoid blocking
      await page.evaluate((btn: any) => {
        btn.click();
      }, loadMoreBtn);
      
      this.logger.debug('Clicked Load More button');
      return true;
      
    } catch (error) {
      this.logger.debug('Failed to click Load More:', error.message);
      return false;
    }
  }

  /**
   * Extract source ID from product URL
   */
  private extractSourceId(url: string): string {
    // Extract ISBN from URL
    const isbnMatch = url.match(/\b\d{10,13}\b/);
    if (isbnMatch) return `WOB-ISBN-${isbnMatch[0]}`;
    
    // Extract from URL path
    const urlObj = new URL(url.startsWith('http') ? url : `https://www.worldofbooks.com${url}`);
    const pathParts = urlObj.pathname.split('/').filter(p => p);
    
    // Get product slug
    const productSlug = pathParts[pathParts.length - 1];
    if (productSlug && productSlug.length > 3) {
      return `WOB-${productSlug}`;
    }
    
    // Fallback: hash of URL
    return `WOB-${Buffer.from(url).toString('base64').substring(0, 15)}`;
  }
}