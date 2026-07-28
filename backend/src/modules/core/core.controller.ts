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
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CoreService } from './core.service';
import { ScraperService } from '../scraper/scraper.service';
import { Category } from '../../entities/category.entity';
import { Navigation } from '../../entities/navigation.entity';
import { Product } from '../../entities/product.entity';
import { ScrapeJob } from '../../entities/scrape-job.entity';
import {
  CacheClearResponseDto,
  CategoryProductsDto,
  CleanupResponseDto,
  ErrorResponseDto,
  HealthResponseDto,
  PaginatedProductsDto,
  ScrapeNavigationResponseDto,
  ScrapeProductResponseDto,
} from '../../common/dto/responses.dto';
import {
  CategoryProductsQueryDto,
  GetCategoriesQueryDto,
  GetCategoryQueryDto,
  GetProductQueryDto,
  LegacyScrapeParamsDto,
  ListProductsQueryDto,
  LegacyScrapeType,
  ScrapeProductBodyDto,
} from './dto';
import { NumericIdParamDto, SlugParamDto, SourceIdParamDto } from '../../common/dto/params.dto';

@ApiTags('catalogue')
@Controller('api')
export class CoreController {
  private readonly logger = new Logger(CoreController.name);

  constructor(
    private readonly coreService: CoreService,
    private readonly scraperService: ScraperService,
  ) {}

  @Get('navigation')
  @ApiOperation({
    summary: 'Navigation headings with their categories',
    description:
      'Served from the database. If the table is empty — a fresh install that has neither ' +
      'been seeded nor scraped — a navigation scrape runs first and its result is returned.',
  })
  @ApiOkResponse({ type: [Navigation] })
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
  @ApiOperation({ summary: 'List categories, optionally filtered to one navigation heading' })
  @ApiOkResponse({ type: [Category] })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Malformed navigation slug' })
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
  @ApiOperation({
    summary: 'One category, with its navigation, children and products',
    description:
      'A slug is unique per navigation heading, not globally — pass `?navigation=` to pick ' +
      'the right one when a collection is listed under several headings.',
  })
  @ApiParam({ name: 'slug', example: 'fantasy-fiction-books' })
  @ApiOkResponse({ type: Category })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'No category with that slug' })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Malformed slug' })
  async getCategory(@Param() params: SlugParamDto, @Query() query: GetCategoryQueryDto) {
    const category = await this.coreService.getCategoryBySlug(params.slug, query.navigation);
    if (!category) {
      throw new NotFoundException(`Category not found: ${params.slug}`);
    }
    return category;
  }

  @Get('categories/:slug/products')
  @ApiOperation({
    summary: 'Products in a category, filling the collection on demand',
    description:
      'Returns stored products immediately and queues a background listing scrape for the ' +
      'next unfetched page. Once the collection is exhausted no further requests are made, ' +
      'so browsing a completed category costs the origin nothing. Responses are cached per ' +
      'page for one hour; empty results are never cached. Pass `?navigation=` to pick which ' +
      'heading\'s copy of the collection to read — each keeps its own products and checkpoint.',
  })
  @ApiParam({ name: 'slug', example: 'fantasy-fiction-books' })
  @ApiOkResponse({ type: CategoryProductsDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'No category with that slug' })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Invalid slug, page or limit' })
  async getCategoryProducts(
    @Param() params: SlugParamDto,
    @Query() query: CategoryProductsQueryDto,
  ) {
    return this.scrapeCategoryOrFail(params.slug, query);
  }

  @Get('products')
  @ApiOperation({
    summary: 'Products across every category',
    description:
      'Reads stored products only — nothing here queues a scrape, so a listing page costs ' +
      'the origin nothing. Pass `category=` to narrow it to one collection, or ' +
      '`random=true` for a sample of products that have a cover, which is what the home ' +
      'shelf shows.',
  })
  @ApiOkResponse({ type: PaginatedProductsDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Invalid page, limit or random' })
  async getProducts(@Query() query: ListProductsQueryDto) {
    try {
      return await this.coreService.getProducts(
        query.page,
        query.limit,
        query.random ?? false,
        query.category,
      );
    } catch (error) {
      this.logger.error(`Products error: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to load products');
    }
  }

  @Get('products/:sourceId')
  @ApiOperation({
    summary: 'One product with its detail',
    description:
      'Detail is scraped lazily — the product page is fetched the first time someone opens ' +
      'it, then served from storage. Pass `refresh=true` to force a re-scrape.',
  })
  @ApiParam({ name: 'sourceId', example: '9846944432401' })
  @ApiOkResponse({ type: Product })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'No product with that source id' })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Malformed source id' })
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
  @ApiOperation({
    summary: 'Re-scrape the navigation tree',
    description: 'Runs synchronously — the mega-menu is a single page load.',
  })
  @ApiOkResponse({ type: ScrapeNavigationResponseDto })
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
  @ApiOperation({
    summary: 'Queue a listing scrape for a category',
    description: 'Returns immediately with whatever is already stored; the scrape runs on the queue.',
  })
  @ApiParam({ name: 'slug', example: 'fantasy-fiction-books' })
  @ApiOkResponse({ type: CategoryProductsDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'No category with that slug' })
  async scrapeCategory(
    @Param() params: SlugParamDto,
    @Query() query: CategoryProductsQueryDto,
  ) {
    this.logger.log(`Manual category scrape triggered via API: ${params.slug}`);
    return this.scrapeCategoryOrFail(params.slug, query);
  }

  @Post('scrape/product/:sourceId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Re-fetch a product on demand' })
  @ApiParam({ name: 'sourceId', example: '9846944432401' })
  @ApiOkResponse({ type: ScrapeProductResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'No product with that source id' })
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
  @ApiOperation({
    summary: 'Generic scrape trigger (legacy)',
    description:
      'Retained for older clients. Prefer scrape/navigation, scrape/category/{slug} and ' +
      'scrape/product/{sourceId}.',
    deprecated: true,
  })
  @ApiOkResponse({ description: 'Shape depends on the scrape type.' })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Unknown scrape type' })
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
  @ApiOperation({ summary: 'Scrape job status' })
  @ApiParam({ name: 'id', example: 7 })
  @ApiOkResponse({ type: ScrapeJob })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'No job with that id' })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'id is not an integer' })
  async getJobStatus(@Param() params: NumericIdParamDto) {
    const job = await this.scraperService.getScrapeJobStatus(params.id);
    if (!job) {
      throw new NotFoundException(`Scrape job not found: ${params.id}`);
    }
    return job;
  }

  @Post('cleanup')
  @HttpCode(200)
  @ApiOperation({ summary: 'Drop stale rows' })
  @ApiOkResponse({ type: CleanupResponseDto })
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
  @ApiOperation({ summary: 'Drop cached responses' })
  @ApiOkResponse({ type: CacheClearResponseDto })
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
  @ApiOperation({ summary: 'Liveness and database connectivity' })
  @ApiOkResponse({ type: HealthResponseDto })
  async healthCheck() {
    return this.coreService.healthCheck();
  }

  // ========== internals ==========

  private async scrapeCategoryOrFail(slug: string, query: CategoryProductsQueryDto) {
    try {
      return await this.scraperService.scrapeCategoryBySlug(slug, {
        page: query.page ?? 1,
        limit: query.limit ?? 24,
        navigationSlug: query.navigation,
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
