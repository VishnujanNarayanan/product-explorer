import { Injectable } from '@nestjs/common';
import { BaseScraper } from './base.scraper';

@Injectable()
export class ProductScraper extends BaseScraper {
  async scrape(url: string): Promise<any> {
    // Product scraping is handled by CategoryScraper
    // This class exists for future expansion
    throw new Error('Use CategoryScraper for product listing pages');
  }
}