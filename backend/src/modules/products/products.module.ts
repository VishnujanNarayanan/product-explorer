import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { Product } from '../../entities/product.entity';
import { ProductDetail } from '../../entities/product-detail.entity';
import { Review } from '../../entities/review.entity';
import { ScraperService } from '../scraper/scraper.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductDetail, Review]),
  ],
  controllers: [ProductsController],
  providers: [ProductsService, ScraperService],
  exports: [ProductsService],
})
export class ProductsModule {}