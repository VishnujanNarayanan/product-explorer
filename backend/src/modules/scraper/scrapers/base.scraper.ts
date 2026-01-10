import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export abstract class BaseScraper {
  protected readonly logger = new Logger(this.constructor.name);

  // Ethical scraping defaults
  protected readonly DEFAULT_DELAY_MS = parseInt(process.env.SCRAPE_DELAY_MS || '3000');
  protected readonly USER_AGENT = process.env.SCRAPE_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  protected readonly MAX_RETRIES = parseInt(process.env.SCRAPE_RETRY_COUNT || '3');

  protected async delay(ms: number = this.DEFAULT_DELAY_MS): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  protected extractSlugFromUrl(url: string): string {
    // Remove protocol, domain, and query parameters
    const cleanUrl = url.replace(/^https?:\/\/[^\/]+/, '').split('?')[0];
    // Get last non-empty path segment
    const segments = cleanUrl.split('/').filter(segment => segment.trim().length > 0);
    return segments.length > 0 ? segments[segments.length - 1] : 'home';
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
        rating: null,
      });
    }
    
    return reviews;
  }

  abstract scrape(url: string, data?: any): Promise<any>;
}