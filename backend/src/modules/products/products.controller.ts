import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('api/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async getProducts(@Query('category') categorySlug: string) {
    if (categorySlug) {
      return this.productsService.getProductsByCategory(categorySlug);
    }
    return this.productsService.getAllProducts();
  }

  @Get(':id')
  async getProduct(@Param('id') sourceId: string) {
    return this.productsService.getProductBySourceId(sourceId);
  }
}