import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { GetProductsQueryDto } from './dto';
import { ErrorResponseDto, PaginatedProductsDto } from '../../common/dto/responses.dto';

/**
 * Paged product listing.
 *
 * Product *detail* deliberately lives on `CoreController` (`GET /api/products/:sourceId`),
 * because reading one product can trigger an on-demand scrape. Declaring a `:id` route here
 * as well would register a second handler for the same path.
 */
@ApiTags('products')
@Controller('api/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({
    summary: 'List products',
    description:
      'Reads stored products only — this endpoint never triggers a scrape. Use ' +
      '`GET /api/categories/{slug}/products` to fill a category on demand.',
  })
  @ApiOkResponse({ type: PaginatedProductsDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Invalid page, limit or category' })
  async getProducts(@Query() query: GetProductsQueryDto) {
    return this.productsService.getProducts({
      categorySlug: query.category,
      page: query.page ?? 1,
      limit: query.limit ?? 24,
    });
  }
}
