import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Navigation } from '../../entities/navigation.entity';
import { Category } from '../../entities/category.entity';

@Injectable()
export class CoreService {
  constructor(
    @InjectRepository(Navigation)
    private navigationRepository: Repository<Navigation>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
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

  async getCategoryBySlug(slug: string): Promise<Category | null> {
    return this.categoryRepository.findOne({
      where: { slug },
      relations: ['navigation', 'children', 'parent', 'products'],
    });
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