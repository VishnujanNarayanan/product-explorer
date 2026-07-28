import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Navigation } from '../../entities/navigation.entity';
import { Category } from '../../entities/category.entity';
import { Product } from '../../entities/product.entity';
import { findCategory } from '../../common/category-lookup';

export interface PaginatedProducts {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

@Injectable()
export class CoreService {
  constructor(
    @InjectRepository(Navigation)
    private navigationRepository: Repository<Navigation>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  async getNavigation(): Promise<Navigation[]> {
    // Return from database, will trigger scrape if empty
    return this.navigationRepository.find({
      relations: ['categories'],
      order: { id: 'ASC' },
    });
  }

  async getCategoriesByNavigation(navigationSlug: string): Promise<Category[]> {
    const navigation = await this.navigationRepository.findOne({
      where: { slug: navigationSlug },
      relations: ['categories'],
    });

    if (!navigation) {
      return [];
    }

    return this.categoryRepository.find({
      where: { navigation: { id: navigation.id } },
      relations: ['children', 'parent'],
      order: { title: 'ASC' },
    });
  }
  async getAllCategories(): Promise<Category[]> {
    return this.categoryRepository.find({
      relations: ['navigation', 'children', 'parent'],
      order: { title: 'ASC' },
    });
  }

  /**
   * A slug identifies a category only within a navigation heading, so callers that know the
   * heading pass it; without one the oldest matching row is returned.
   */
  async getCategoryBySlug(slug: string, navigationSlug?: string): Promise<Category | null> {
    return findCategory(this.categoryRepository, slug, navigationSlug, [
      'navigation',
      'children',
      'parent',
      'products',
    ]);
  }

  /**
   * Products across every category, straight from storage — this never scrapes, so the
   * home page can fill itself without touching the origin.
   *
   * `random` draws a fresh sample instead of a page: the home shelf is meant to turn over
   * on every visit. Sampling is limited to products that have a cover, because a shelf of
   * placeholder tiles is not worth showing.
   */
  async getProducts(page = 1, limit = 24, random = false): Promise<PaginatedProducts> {
    const query = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category');

    if (random) {
      const products = await query
        .where("product.image_url <> ''")
        .orderBy('RANDOM()')
        .take(limit)
        .getMany();

      const total = await this.productRepository.count();
      return { products, total, page: 1, limit, hasMore: total > products.length };
    }

    const [products, total] = await query
      .orderBy('product.last_scraped_at', 'DESC')
      .addOrderBy('product.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { products, total, page, limit, hasMore: page * limit < total };
  }

  async healthCheck(): Promise<{ status: string; timestamp: Date; services: any }> {
    // Test database connection
    let dbStatus = 'OK';
    try {
      await this.navigationRepository.count();
    } catch (error) {
      dbStatus = `ERROR: ${error.message}`;
    }

    return {
      status: 'OK',
      timestamp: new Date(),
      services: {
        database: dbStatus,
      },
    };
  }
}