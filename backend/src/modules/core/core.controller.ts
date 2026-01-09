import { Controller, Get, Post, Param, Query, Logger, InternalServerErrorException } from '@nestjs/common';
import { CoreService } from './core.service';
import { ScraperService } from '../scraper/scraper.service';

@Controller('api')
export class CoreController {
  private readonly logger = new Logger(CoreController.name);

  constructor(
    private readonly coreService: CoreService,
    private readonly scraperService: ScraperService,
  ) {}

  @Get('navigation')
  async getNavigation() {
    try {
      // First check if we have data
      const navItems = await this.coreService.getNavigation();
      
      // If no data, trigger scrape
      if (navItems.length === 0) {
        this.logger.log('No navigation data found, triggering scrape...');
        return this.scraperService.scrapeAndSaveNavigation();
      }
      
      return navItems;
    } catch (error) {
      this.logger.error(`Navigation error: ${error.message}`);
      throw new InternalServerErrorException('Failed to load navigation');
    }
  }

  @Get('categories')
  async getCategories(@Query('navigation') navigationSlug: string) {
    try {
      if (navigationSlug) {
        return this.coreService.getCategoriesByNavigation(navigationSlug);
      }
      
      // Return all categories
      return this.coreService.getAllCategories();
    } catch (error) {
      this.logger.error(`Categories error: ${error.message}`);
      throw new InternalServerErrorException('Failed to load categories');
    }
  }

  @Get('categories/:slug')
  async getCategory(@Param('slug') slug: string) {
    try {
      return this.coreService.getCategoryBySlug(slug);
    } catch (error) {
      this.logger.error(`Category error: ${error.message}`);
      throw new InternalServerErrorException(`Failed to load category: ${slug}`);
    }
  }

  @Get('categories/:slug/products')
  async getCategoryProducts(@Param('slug') slug: string) {
    try {
      return this.scraperService.scrapeCategoryBySlug(slug);
    } catch (error) {
      this.logger.error(`Category products error: ${error.message}`);
      throw new InternalServerErrorException(`Failed to load products for category: ${slug}`);
    }
  }

  @Get('products/:id')
  async getProduct(@Param('id') sourceId: string, @Query('refresh') refresh: string) {
    try {
      const forceRefresh = refresh === 'true';
      return this.scraperService.scrapeProductBySourceId(sourceId, forceRefresh);
    } catch (error) {
      this.logger.error(`Product error: ${error.message}`);
      throw new InternalServerErrorException(`Failed to load product: ${sourceId}`);
    }
  }

  @Post('scrape/:type/:target')
  async triggerScrape(
    @Param('type') type: 'navigation' | 'category' | 'product',
    @Param('target') target: string,
  ) {
    try {
      return this.scraperService.triggerOnDemandScrape(type, target);
    } catch (error) {
      this.logger.error(`Scrape trigger error: ${error.message}`);
      throw new InternalServerErrorException(`Failed to trigger scrape: ${type}/${target}`);
    }
  }

  @Get('jobs/:id')
  async getJobStatus(@Param('id') id: string) {
    try {
      return this.scraperService.getScrapeJobStatus(parseInt(id));
    } catch (error) {
      this.logger.error(`Job status error: ${error.message}`);
      throw new InternalServerErrorException(`Failed to get job status: ${id}`);
    }
  }

  @Get('test')
  async test() {
    return {
      status: 'OK',
      timestamp: new Date(),
      message: 'Backend is working',
      endpoints: {
        health: 'GET /api/health',
        navigation: 'GET /api/navigation',
        testScrape: 'GET /api/test-scrape'
      }
    };
  }

  @Get('test-scrape')
  async testScrape() {
    try {
      // Simple test without database
      return { 
        success: true, 
        message: 'Scraper test endpoint',
        time: new Date()
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        stack: error.stack 
      };
    }
  }

  @Get('health')
  async healthCheck() {
    return this.coreService.healthCheck();
  }
}