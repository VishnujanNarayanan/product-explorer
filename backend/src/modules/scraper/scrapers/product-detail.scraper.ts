import { Injectable } from '@nestjs/common';
import { PlaywrightCrawler } from 'crawlee';
import { BaseScraper } from './base.scraper';

export interface ProductDetailData {
  source_id: string;
  description: string;
  specs: {
    isbn13?: string;
    isbn10?: string;
    publisher?: string;
    year_published?: string;
    binding_type?: string;
    condition?: string;
    pages?: number;
    sku?: string;
  };
  reviews: Array<{
    text: string;
    author: string | null;
    rating: number | null;
  }>;
  related_products: Array<{
    source_id: string;
    title: string;
    url: string;
    price: number;
  }>;
}

@Injectable()
export class ProductDetailScraper extends BaseScraper {
  private readonly SELECTORS = {
    DESCRIPTION: '.product-accordion .panel',
    ADDITIONAL_INFO_TABLE: '.additional-info-table',
    INFO_ISBN13: '#info-isbn13',
    INFO_ISBN10: '#info-isbn10',
    INFO_PUBLISHER: '#info-publisher',
    INFO_YEAR_PUBLISHED: '#info-year-published',
    INFO_BINDING_TYPE: '#info-binding-type',
    INFO_CONDITION: '#info-condition',
    INFO_PAGES: '#info-number-of-pages',
    INFO_SKU: '#info-sku',
    RELATED_PRODUCTS: '.algolia-related-products-container .main-product-card',
    RELATED_TITLE: '.card__heading.h5 a',
    RELATED_PRICE: '.price .price-item',
  };

  async scrape(url: string, sourceId: string): Promise<ProductDetailData> {
    let productData: ProductDetailData = {
      source_id: sourceId,
      description: '',
      specs: {},
      reviews: [],
      related_products: [],
    };

    // @ts-ignore - Type issues with Crawlee v3
    const crawler = new PlaywrightCrawler({
      maxRequestsPerCrawl: 50,
      maxConcurrency: 1,
      requestHandlerTimeoutSecs: 60,
      
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
        this.logger.log(`Scraping product detail: ${sourceId} from ${request.url}`);
        
        await page.waitForSelector('body', { timeout: 10000 });
        await this.delay();

        // Extract description
        try {
          const descriptionElement = await page.$(this.SELECTORS.DESCRIPTION);
          if (descriptionElement) {
            const descriptionText = await descriptionElement.textContent();
            productData.description = descriptionText?.trim() || '';
            
            // Extract reviews from description
            productData.reviews = this.extractReviewFromDescription(productData.description);
          }
        } catch (error: any) {
          this.logger.warn(`Failed to extract description: ${error.message}`);
        }

        // Extract additional information/specs
        try {
          const tableExists = await page.$(this.SELECTORS.ADDITIONAL_INFO_TABLE);
          if (tableExists) {
            productData.specs = {
              isbn13: await this.extractTableValue(page, this.SELECTORS.INFO_ISBN13),
              isbn10: await this.extractTableValue(page, this.SELECTORS.INFO_ISBN10),
              publisher: await this.extractTableValue(page, this.SELECTORS.INFO_PUBLISHER),
              year_published: await this.extractTableValue(page, this.SELECTORS.INFO_YEAR_PUBLISHED),
              binding_type: await this.extractTableValue(page, this.SELECTORS.INFO_BINDING_TYPE),
              condition: await this.extractTableValue(page, this.SELECTORS.INFO_CONDITION),
              pages: parseInt(await this.extractTableValue(page, this.SELECTORS.INFO_PAGES) || '0'),
              sku: await this.extractTableValue(page, this.SELECTORS.INFO_SKU),
            };
          }
        } catch (error: any) {
          this.logger.warn(`Failed to extract specs: ${error.message}`);
        }

        // Extract related products
        try {
          const relatedElements = await page.$$(this.SELECTORS.RELATED_PRODUCTS);
          
          for (const relatedEl of relatedElements) {
            try {
              const titleElement = await relatedEl.$(this.SELECTORS.RELATED_TITLE);
              const priceElement = await relatedEl.$(this.SELECTORS.RELATED_PRICE);
              
              const title = await titleElement?.textContent();
              const priceText = await priceElement?.textContent();
              const productUrl = await titleElement?.getAttribute('href');
              
              if (title && productUrl) {
                const relatedSourceId = this.extractSourceIdFromUrl(productUrl);
                const { amount: price } = this.normalizePrice(priceText || '');
                const fullUrl = productUrl.startsWith('http') ? productUrl : `https://www.worldofbooks.com${productUrl}`;
                
                productData.related_products.push({
                  source_id: relatedSourceId,
                  title: title.trim(),
                  url: fullUrl,
                  price,
                });
              }
            } catch (error: any) {
              // Skip individual related product errors
            }
          }
        } catch (error: any) {
          this.logger.warn(`Failed to extract related products: ${error.message}`);
        }

        this.logger.log(`Successfully scraped detail for: ${sourceId}`);
        this.logger.debug(`Found ${productData.reviews.length} reviews and ${productData.related_products.length} related products`);
      },
    });

    await crawler.run([{ 
      url, 
      uniqueKey: `product-detail-${sourceId}`,
      label: 'product-detail',
      userData: { sourceId }
    }]);
    return productData;
  }

  private async extractTableValue(page: any, selector: string): Promise<string> {
    try {
      const element = await page.$(selector);
      if (element) {
        const text = await element.textContent();
        return text?.trim() || '';
      }
    } catch (error: any) {
      // Return empty if element not found
    }
    return '';
  }

  private extractSourceIdFromUrl(url: string): string {
    const isbnMatch = url.match(/\d{10,13}/);
    if (isbnMatch) {
      return `WOB-ISBN-${isbnMatch[0]}`;
    }
    return `WOB-REL-${Buffer.from(url).toString('base64').substring(0, 15)}`;
  }
}