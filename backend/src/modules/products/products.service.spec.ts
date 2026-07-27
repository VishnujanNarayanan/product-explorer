import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { Product } from '../../entities/product.entity';

describe('ProductsService', () => {
  let service: ProductsService;
  let findAndCount: jest.Mock;

  beforeEach(async () => {
    findAndCount = jest.fn().mockResolvedValue([[], 0]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(Product), useValue: { findAndCount } },
      ],
    }).compile();

    service = module.get(ProductsService);
  });

  it('translates page/limit into skip/take', async () => {
    await service.getProducts({ page: 3, limit: 20 });

    expect(findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 40, take: 20 }),
    );
  });

  it('does not skip anything on the first page', async () => {
    await service.getProducts({ page: 1, limit: 24 });
    expect(findAndCount).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 24 }));
  });

  it('filters by category slug when one is given', async () => {
    await service.getProducts({ categorySlug: 'fantasy-fiction-books', page: 1, limit: 10 });

    expect(findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { category: { slug: 'fantasy-fiction-books' } } }),
    );
  });

  it('applies no filter when no category is given', async () => {
    await service.getProducts({ page: 1, limit: 10 });
    expect(findAndCount).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  // Ordering has to be deterministic, or paging can show the same row twice.
  it('orders deterministically', async () => {
    await service.getProducts({ page: 1, limit: 10 });
    expect(findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ order: { id: 'ASC' } }),
    );
  });

  describe('hasMore', () => {
    it.each([
      [1, 10, 100, true],
      [9, 10, 100, true],
      [10, 10, 100, false], // exactly consumed
      [11, 10, 100, false], // past the end
      [1, 10, 0, false], // nothing at all
    ])('page %i of %i with %i total -> %s', async (page, limit, total, expected) => {
      findAndCount.mockResolvedValue([[], total]);
      const result = await service.getProducts({ page, limit });
      expect(result.hasMore).toBe(expected);
      expect(result.total).toBe(total);
    });
  });

  it('echoes the requested page and limit back to the caller', async () => {
    findAndCount.mockResolvedValue([[{ id: 1 } as Product], 5]);
    const result = await service.getProducts({ page: 2, limit: 3 });

    expect(result).toEqual({
      products: [{ id: 1 }],
      total: 5,
      page: 2,
      limit: 3,
      hasMore: false,
    });
  });

  it('loads the category relation so the client can label results', async () => {
    await service.getProducts({ page: 1, limit: 10 });
    expect(findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ relations: ['category'] }),
    );
  });
});

// Guards a wiring bug that shipped: the module used to declare ScraperService as a local
// provider, which builds a second instance without its scrapers or queue and crashes boot.
describe('ProductsModule wiring', () => {
  it('does not declare ScraperService as a local provider', async () => {
    const { ProductsModule } = await import('./products.module');
    const providers = Reflect.getMetadata('providers', ProductsModule) as unknown[];
    const names = providers.map((p: any) => p?.name ?? String(p));

    expect(names).toContain('ProductsService');
    expect(names).not.toContain('ScraperService');
  });
});
