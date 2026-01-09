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
  };

  async scrape(url: string, categorySlug: string): Promise<ProductPreview[]> {
    const products: ProductPreview[] = [];

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
        this.logger.log(`Scraping category: ${categorySlug} from ${request.url}`);
        
        let hasMoreProducts = true;
        let pageCount = 0;
        const MAX_PAGES = 3; // Limit for demo/ethics

        while (hasMoreProducts && pageCount < MAX_PAGES) {
          await page.waitForSelector(this.SELECTORS.PRODUCT_GRID, { timeout: 10000 });
          await this.delay();

          // Extract products from current page
          const productElements = await page.$$(this.SELECTORS.PRODUCT_CARD);
          
          for (const productEl of productElements) {
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

              if (!title || !productUrl) continue;

              // Extract source_id from URL or create hash
              const sourceId = this.extractSourceId(productUrl);
              const fullProductUrl = productUrl.startsWith('http') ? productUrl : `https://www.worldofbooks.com${productUrl}`;
              const { amount: price, currency } = this.normalizePrice(priceText || '');

              // Check for duplicates in current batch
              const isDuplicate = products.some(p => p.source_id === sourceId);
              if (isDuplicate) continue;

              products.push({
                source_id: sourceId,
                title: title.trim(),
                author: author?.trim() || 'Unknown',
                price,
                currency,
                image_url: imageUrl || '',
                source_url: fullProductUrl,
                category_slug: categorySlug,
              });

              this.logger.debug(`Found product: ${title}`);

            } catch (error) {
              this.logger.warn(`Failed to parse product: ${error.message}`);
            }
          }

          // Check for and click "Load more" button
          try {
            const loadMoreButton = await page.$(this.SELECTORS.LOAD_MORE_BUTTON);
            const isVisible = await loadMoreButton?.isVisible();
            
            if (loadMoreButton && isVisible) {
              this.logger.log(`Clicking "Load more" (page ${pageCount + 2})`);
              await loadMoreButton.click();
              pageCount++;
              await this.delay(2000); // Wait for new products to load
              
              // Verify new products loaded
              const newProductCount = await page.$$eval(
                this.SELECTORS.PRODUCT_CARD,
                elements => elements.length
              );
              
              if (newProductCount <= products.length) {
                hasMoreProducts = false;
                this.logger.log('No new products loaded, stopping pagination');
              }
            } else {
              hasMoreProducts = false;
              this.logger.log('No "Load more" button found or not visible');
            }
          } catch (error) {
            hasMoreProducts = false;
            this.logger.warn(`Error with pagination: ${error.message}`);
          }
        }

        this.logger.log(`Scraped ${products.length} products from category: ${categorySlug}`);
      },
    });

    await crawler.run([url]);
    return products;
  }

  private extractSourceId(url: string): string {
    // Try to extract ISBN from URL
    const isbnMatch = url.match(/\d{10,13}/);
    if (isbnMatch) {
      return `WOB-ISBN-${isbnMatch[0]}`;
    }
    
    // Fallback: create hash from URL
    return `WOB-${Buffer.from(url).toString('base64').substring(0, 20)}`;
  }
}