import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../../entities/product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  async getProductsByCategory(categorySlug: string) {
    return this.productRepository.find({
      where: { category: { slug: categorySlug } },
      relations: ['category'],
    });
  }

  async getAllProducts() {
    return this.productRepository.find({
      relations: ['category'],
    });
  }

  async getProductBySourceId(sourceId: string) {
    return this.productRepository.findOne({
      where: { source_id: sourceId },
      relations: ['category', 'detail', 'reviews'],
    });
  }
}