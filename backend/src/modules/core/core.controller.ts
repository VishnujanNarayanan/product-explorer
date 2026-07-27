import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CoreService } from './core.service';
import { ScraperService } from '../scraper/scraper.service';
import {
  CategoryProductsQueryDto,
  GetCategoriesQueryDto,
  GetProductQueryDto,
  LegacyScrapeParamsDto,
  LegacyScrapeType,
  ScrapeProductBodyDto,
} from './dto';
import { NumericIdParamDto, SlugParamDto, SourceIdParamDto } from '../../common/dto/params.dto';

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
      const navItems = await this.coreService.getNavigation();

      // Empty table means the app has never been seeded or scraped — fill it on first ask.
      if (navItems.length === 0) {
        this.logger.log('No navigation data found, triggering scrape...');
        return this.scraperService.scrapeAndSaveNavigation();
      }

      return navItems;
    } catch (error) {
      this.logger.error(`Navigation error: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to load navigation');
    }
  }

  @Get('categories')
  async getCategories(@Query() query: GetCategoriesQueryDto) {
    try {
      if (query.navigation) {
        return await this.coreService.getCategoriesByNavigation(query.navigation);
      }
      return await this.coreService.getAllCategories();
    } catch (error) {
      this.logger.error(`Categories error: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to load categories');
    }
  }

  @Get('categories/:slug')
  async getCategory(@Param() params: SlugParamDto) {
    const category = await this.coreService.getCategoryBySlug(params.slug);
    if (!category) {
      throw new NotFoundException(`Category not found: ${params.slug}`);
    }
    return category;
  }

  @Get('categories/:slug/products')
  async getCategoryProducts(
    @Param() params: SlugParamDto,
    @Query() query: CategoryProductsQueryDto,
  ) {
    return this.scrapeCategoryOrFail(params.slug, query);
  }

  @Get('products/:sourceId')
  async getProduct(@Param() params: SourceIdParamDto, @Query() query: GetProductQueryDto) {
    const product = await this.scrapeProductOrFail(params.sourceId, query.refresh ?? false);
    if (!product) {
      throw new NotFoundException(`Product not found: ${params.sourceId}`);
    }
    return product;
  }

  // ========== SCRAPE ENDPOINTS ==========

  @Post('scrape/navigation')
  @HttpCode(200)
  async scrapeNavigation() {
    try {
      this.logger.log('Manual navigation scrape triggered via API');
      const result = await this.scraperService.scrapeAndSaveNavigation();
      return {
        success: true,
        message: `Navigation scraping completed. Found ${result.length} navigation items.`,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Navigation scrape error: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to scrape navigation');
    }
  }

  @Post('scrape/category/:slug')
  @HttpCode(200)
  async scrapeCategory(
    @Param() params: SlugParamDto,
    @Query() query: CategoryProductsQueryDto,
  ) {
    this.logger.log(`Manual category scrape triggered via API: ${params.slug}`);
    return this.scrapeCategoryOrFail(params.slug, query);
  }

  @Post('scrape/product/:sourceId')
  @HttpCode(200)
  async scrapeProduct(@Param() params: SourceIdParamDto, @Body() body: ScrapeProductBodyDto) {
    this.logger.log(`Manual product scrape triggered via API: ${params.sourceId}`);
    const forceRefresh = body.refresh ?? false;
    const product = await this.scrapeProductOrFail(params.sourceId, forceRefresh);

    if (!product) {
      throw new NotFoundException(`Product not found: ${params.sourceId}`);
    }

    return {
      success: true,
      message: `Product ${forceRefresh ? 're-scraped' : 'loaded'} successfully`,
      data: product,
      hasDetails: !!product.detail,
      jobQueued: forceRefresh || !product.detail,
    };
  }

  /**
   * Retained for older clients. `scrape/navigation`, `scrape/category/:slug` and
   * `scrape/product/:sourceId` are the current routes.
   */
  @Post('scrape/:type/:target')
  @HttpCode(200)
  async triggerScrape(@Param() params: LegacyScrapeParamsDto) {
    try {
      this.logger.log(`Legacy scrape endpoint called: ${params.type}/${params.target}`);

      const target =
        params.type === LegacyScrapeType.NAVIGATION &&
        (params.target === 'home' || params.target === 'all')
          ? 'https://www.worldofbooks.com/en-gb'
          : params.target;

      return await this.scraperService.triggerOnDemandScrape(params.type, target);
    } catch (error) {
      this.logger.error(`Scrape trigger error: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to trigger scrape: ${params.type}/${params.target}`,
      );
    }
  }

  // ========== UTILITY ENDPOINTS ==========

  @Get('jobs/:id')
  async getJobStatus(@Param() params: NumericIdParamDto) {
    const job = await this.scraperService.getScrapeJobStatus(params.id);
    if (!job) {
      throw new NotFoundException(`Scrape job not found: ${params.id}`);
    }
    return job;
  }

  @Post('cleanup')
  @HttpCode(200)
  async cleanupData() {
    try {
      return await this.scraperService.cleanupOldData();
    } catch (error) {
      this.logger.error(`Cleanup error: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to cleanup data');
    }
  }

  @Post('cache/clear')
  @HttpCode(200)
  async clearCache() {
    try {
      await this.scraperService.clearCache();
      return {
        success: true,
        message: 'Cache cleared successfully',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Cache clear error: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to clear cache');
    }
  }

  @Get('health')
  async healthCheck() {
    return this.coreService.healthCheck();
  }

  // ========== internals ==========

  private async scrapeCategoryOrFail(slug: string, query: CategoryProductsQueryDto) {
    try {
      return await this.scraperService.scrapeCategoryBySlug(slug, {
        page: query.page ?? 1,
        limit: query.limit ?? 24,
      });
    } catch (error) {
      // A deliberate 404 from the service must reach the client as a 404. Wrapping every
      // failure in a 500 told callers "the server is broken" when they had simply asked for
      // a category that does not exist.
      if (error instanceof HttpException) throw error;
      this.logger.error(`Category products error (${slug}): ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to load products for category: ${slug}`);
    }
  }

  private async scrapeProductOrFail(sourceId: string, refresh: boolean) {
    try {
      return await this.scraperService.scrapeProductBySourceId(sourceId, refresh);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Product error (${sourceId}): ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to load product: ${sourceId}`);
    }
  }
}
