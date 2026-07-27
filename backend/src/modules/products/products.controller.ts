import { Controller, Get, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { GetProductsQueryDto } from './dto';

/**
 * Paged product listing.
 *
 * Product *detail* deliberately lives on `CoreController` (`GET /api/products/:sourceId`),
 * because reading one product can trigger an on-demand scrape. Declaring a `:id` route here
 * as well would register a second handler for the same path.
 */
@Controller('api/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async getProducts(@Query() query: GetProductsQueryDto) {
    return this.productsService.getProducts({
      categorySlug: query.category,
      page: query.page ?? 1,
      limit: query.limit ?? 24,
    });
  }
}
