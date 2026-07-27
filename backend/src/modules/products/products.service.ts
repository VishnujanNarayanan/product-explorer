import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../../entities/product.entity';

export interface PaginatedProducts {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  /**
   * Listing endpoints are paged. Previously they returned every matching row, which meant a
   * single request could pull the whole catalogue into memory as the scraper fills it up.
   */
  async getProducts(options: {
    categorySlug?: string;
    page: number;
    limit: number;
  }): Promise<PaginatedProducts> {
    const { categorySlug, page, limit } = options;

    const [products, total] = await this.productRepository.findAndCount({
      where: categorySlug ? { category: { slug: categorySlug } } : {},
      relations: ['category'],
      order: { id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      products,
      total,
      page,
      limit,
      hasMore: page * limit < total,
    };
  }

}
