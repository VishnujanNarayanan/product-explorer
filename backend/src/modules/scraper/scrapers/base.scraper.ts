import { PlaywrightCrawler, ProxyConfiguration } from 'crawlee';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export abstract class BaseScraper {
  protected readonly logger = new Logger(this.constructor.name);
  protected crawler: PlaywrightCrawler;

  // Ethical scraping defaults
  protected readonly DEFAULT_DELAY_MS = parseInt(process.env.SCRAPE_DELAY_MS || '3000');
  protected readonly USER_AGENT = process.env.SCRAPE_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  protected readonly MAX_RETRIES = parseInt(process.env.SCRAPE_RETRY_COUNT || '3');

  constructor() {
    this.initializeCrawler();
  }

  protected initializeCrawler(): void {
    this.crawler = new PlaywrightCrawler({
      // Request handler will be set by child classes
      requestHandler: async () => {},

      // Ethical scraping configuration
      maxRequestsPerCrawl: 50,
      maxConcurrency: 1, // Be polite - one at a time
      requestHandlerTimeoutSecs: 60,
      
      // Error handling
      failedRequestHandler: async ({ request, error }) => {
        let errorMsg = '';
        if (error instanceof Error) {
          errorMsg = error.message;
        } else {
          errorMsg = String(error);
        }
        this.logger.error(`Request ${request.url} failed: ${errorMsg}`);
      },

      // Browser configuration
      launchContext: {
        launchOptions: {
          headless: true, // Set to false for debugging
        },
      },

      // Session and retry logic
      useSessionPool: true,
      persistCookiesPerSession: true,
      maxRequestRetries: this.MAX_RETRIES,
      retryOnBlocked: true,
    });
  }

  protected async delay(ms: number = this.DEFAULT_DELAY_MS): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  protected extractSlugFromUrl(url: string): string {
    return url.split('/').filter(Boolean).pop() || '';
  }

  protected normalizePrice(priceText: string): { amount: number; currency: string } {
    const match = priceText.match(/([£$€])([\d,.]+)/);
    if (match) {
      const currency = match[1];
      const amount = parseFloat(match[2].replace(',', ''));
      return { amount, currency };
    }
    return { amount: 0, currency: 'GBP' };
  }

  protected extractReviewFromDescription(description: string): Array<{
    text: string;
    author: string | null;
    rating: number | null;
  }> {
    const reviews: Array<{ text: string; author: string | null; rating: number | null }> = [];
    
    // Look for quote patterns with attribution
    const quotePattern = /([^"']+)["']([^"']+)["']\s*--\s*([^.,]+)/gi;
    let match;
    
    while ((match = quotePattern.exec(description)) !== null) {
      reviews.push({
        text: match[2].trim(),
        author: match[3].trim(),
        rating: null, // No star ratings available
      });
    }
    
    return reviews;
  }

  abstract scrape(url: string, data?: any): Promise<any>;
}