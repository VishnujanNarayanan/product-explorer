import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { Product } from '../../entities/product.entity';
import { ProductDetail } from '../../entities/product-detail.entity';
import { Review } from '../../entities/review.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Product, ProductDetail, Review])],
  controllers: [ProductsController],
  // ScraperService used to be listed here. Re-declaring it as a local provider builds a
  // second instance without the scrapers and queue it depends on, which is why registering
  // this module failed to boot. Nothing in this module needs it: scraping is triggered
  // through CoreController.
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
