  import { Controller, Get, Post, Param, Query, Logger, InternalServerErrorException, Body } from '@nestjs/common';
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

    // ========== NEW CLEAN SCRAPE ENDPOINTS ==========

    @Post('scrape/navigation')
    async scrapeNavigation() {
      try {
        this.logger.log('Manual navigation scrape triggered via API');
        const result = await this.scraperService.scrapeAndSaveNavigation();
        return {
          success: true,
          message: `Navigation scraping completed. Found ${result.length} navigation items.`,
          data: result
        };
      } catch (error) {
        this.logger.error(`Navigation scrape error: ${error.message}`);
        throw new InternalServerErrorException('Failed to scrape navigation');
      }
    }

    @Post('scrape/category/:slug')
    async scrapeCategory(@Param('slug') slug: string) {
      try {
        this.logger.log(`Manual category scrape triggered via API: ${slug}`);
        return this.scraperService.scrapeCategoryBySlug(slug);
      } catch (error) {
        this.logger.error(`Category scrape error: ${error.message}`);
        throw new InternalServerErrorException(`Failed to scrape category: ${slug}`);
      }
    }

    @Post('scrape/product/:sourceId')
    async scrapeProduct(
      @Param('sourceId') sourceId: string,
      @Body() body: { refresh?: boolean }
    ) {
      try {
        this.logger.log(`Manual product scrape triggered via API: ${sourceId}`);
        const forceRefresh = body?.refresh || false;
        const product = await this.scraperService.scrapeProductBySourceId(sourceId, forceRefresh);
        
        if (!product) {
          return {
            success: false,
            message: `Product not found: ${sourceId}`,
            data: null,
            hasDetails: false,
            jobQueued: false
          };
        }
        
        return {
          success: true,
          message: `Product ${forceRefresh ? 're-scraped' : 'loaded'} successfully`,
          data: product,
          hasDetails: !!product.detail,
          jobQueued: forceRefresh || !product.detail
        };
      } catch (error) {
        this.logger.error(`Product scrape error: ${error.message}`);
        
        // Return structured error response
        return {
          success: false,
          message: `Failed to scrape product: ${sourceId}`,
          error: error.message,
          data: null,
          hasDetails: false,
          jobQueued: false
        };
      }
    }

    // ========== LEGACY ENDPOINT (for backward compatibility) ==========

    @Post('scrape/:type/:target')
    async triggerScrape(
      @Param('type') type: 'navigation' | 'category' | 'product',
      @Param('target') target: string,
    ) {
      try {
        this.logger.log(`Legacy scrape endpoint called: ${type}/${target}`);
        
        // Map to appropriate methods
        switch (type) {
          case 'navigation':
            // For navigation, target can be ignored or used as URL
            const url = target === 'home' || target === 'all' ? 
              'https://www.worldofbooks.com' : target;
            return this.scraperService.triggerOnDemandScrape(type, url);
            
          case 'category':
            return this.scraperService.triggerOnDemandScrape(type, target);
            
          case 'product':
            return this.scraperService.triggerOnDemandScrape(type, target);
            
          default:
            throw new Error(`Unknown scrape type: ${type}`);
        }
      } catch (error) {
        this.logger.error(`Scrape trigger error: ${error.message}`);
        throw new InternalServerErrorException(`Failed to trigger scrape: ${type}/${target}`);
      }
    }

    // ========== UTILITY ENDPOINTS ==========

    @Get('jobs/:id')
    async getJobStatus(@Param('id') id: string) {
      try {
        return this.scraperService.getScrapeJobStatus(parseInt(id));
      } catch (error) {
        this.logger.error(`Job status error: ${error.message}`);
        throw new InternalServerErrorException(`Failed to get job status: ${id}`);
      }
    }
    @Post('cleanup')
    async cleanupData() {
      try {
        return this.scraperService.cleanupOldData();
      } catch (error) {
        this.logger.error(`Cleanup error: ${error.message}`);
        throw new InternalServerErrorException('Failed to cleanup data');
      }
    }
    @Post('cache/clear')
    async clearCache() {
      try {
        await this.scraperService.clearCache();
        return { 
          success: true, 
          message: 'Cache cleared successfully',
          timestamp: new Date()
        };
      } catch (error) {
        this.logger.error(`Cache clear error: ${error.message}`);
        throw new InternalServerErrorException('Failed to clear cache');
      }
    }

    @Get('test')
    async test() {
      return {
        status: 'OK',
        timestamp: new Date(),
        message: 'Backend is working',
        endpoints: {
          scrapeNavigation: 'POST /api/scrape/navigation',
          scrapeCategory: 'POST /api/scrape/category/{slug}',
          scrapeProduct: 'POST /api/scrape/product/{sourceId}',
          getNavigation: 'GET /api/navigation',
          getCategories: 'GET /api/categories',
          clearCache: 'POST /api/cache/clear'
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