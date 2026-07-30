import { Logger } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { CategoryScrapeResult } from './scrapers/category.scraper';
import { Category } from '../../entities/category.entity';
import { Product } from '../../entities/product.entity';

/**
 * A category nobody has opened yet holds no products, and the queue that would fill it may not
 * be running — on a small instance it may not be reachable at all. Handing back an empty grid
 * made the client conclude the collection was empty, which is how a deployment with 102 unvisited
 * categories looked broken to every visitor.
 *
 * The listing scraper reads Shopify's products.json over HTTP and never launches a browser, so
 * fetching a page while someone waits costs one outbound request. These tests pin down when that
 * happens, when it must not, and that its failure is survivable.
 */
describe('ScraperService inline category scrape', () => {
  const scraped = [
    {
      source_id: '111',
      title: 'Murder on the Orient Express',
      author: 'Agatha Christie',
      price: 3.5,
      currency: 'GBP',
      image_url: 'https://cdn.shopify.com/x.jpg',
      source_url: 'https://www.worldofbooks.com/en-gb/products/x',
      category_slug: 'author-books-by-agatha-christie',
      description: '',
    },
  ];

  const result: CategoryScrapeResult = {
    products: scraped,
    pagesFetched: 1,
    nextPage: 2,
    exhausted: false,
  };

  function makeService(options: {
    category?: Partial<Category>;
    /** Rows the database returns, in call order. */
    reads?: [Product[], number][];
    scrape?: jest.Mock;
  }) {
    const service = Object.create(ScraperService.prototype) as ScraperService;
    const warn = jest.fn();
    const category = {
      id: 7,
      slug: 'author-books-by-agatha-christie',
      is_exhausted: false,
      last_page_scraped: 0,
      product_count: 0,
      navigation: null,
      ...options.category,
    };

    const findAndCount = jest.fn();
    for (const read of options.reads ?? [[[], 0]]) findAndCount.mockResolvedValueOnce(read);
    findAndCount.mockResolvedValue([[], 0]);

    const scrape = options.scrape ?? jest.fn().mockResolvedValue(result);

    const fields: Record<string, unknown> = {
      logger: { log: jest.fn(), error: jest.fn(), warn } as unknown as Logger,
      categoryScraper: { scrape },
      // Redis is absent throughout: these paths must not depend on it.
      cacheManager: {
        get: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
        set: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
        del: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      },
      scrapingQueue: { add: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) },
      categoryRepo: { findOne: jest.fn().mockResolvedValue(category), save: jest.fn() },
      productRepo: {
        findAndCount,
        findOne: jest.fn().mockResolvedValue(null),
        save: jest.fn((row) => Promise.resolve(row)),
        create: jest.fn((row) => row),
        count: jest.fn().mockResolvedValue(scraped.length),
      },
      degraded: { cache: false, queue: false },
    };

    for (const [key, value] of Object.entries(fields)) {
      Object.defineProperty(service, key, { value, writable: true });
    }

    return { service, scrape, warn, category };
  }

  it('scrapes a category that has nothing stored and returns what it found', async () => {
    const stored = [{ id: 1, title: 'Murder on the Orient Express' }] as unknown as Product[];
    const { service, scrape } = makeService({ reads: [[[], 0], [stored, 1]] });

    const response = await service.scrapeCategoryBySlug('author-books-by-agatha-christie');

    expect(scrape).toHaveBeenCalledWith('author-books-by-agatha-christie', {
      startPage: 1,
      maxPages: 1,
    });
    expect(response.products).toEqual(stored);
    expect(response.message).toContain('Scraped');
  });

  it('resumes from the page after the last one stored', async () => {
    const { service, scrape } = makeService({ category: { last_page_scraped: 3 } });

    await service.scrapeCategoryBySlug('author-books-by-agatha-christie');

    expect(scrape).toHaveBeenCalledWith(expect.any(String), { startPage: 4, maxPages: 1 });
  });

  it('does not scrape when the category already has products', async () => {
    const stored = [{ id: 1 }] as unknown as Product[];
    const { service, scrape } = makeService({ reads: [[stored, 40]] });

    await service.scrapeCategoryBySlug('author-books-by-agatha-christie');

    expect(scrape).not.toHaveBeenCalled();
  });

  it('does not scrape an exhausted collection that is genuinely empty', async () => {
    const { service, scrape } = makeService({ category: { is_exhausted: true } });

    const response = await service.scrapeCategoryBySlug('author-books-by-agatha-christie');

    expect(scrape).not.toHaveBeenCalled();
    expect(response.message).toContain('fully scraped');
  });

  it('answers with stored data when the scrape fails rather than failing the read', async () => {
    const scrape = jest.fn().mockRejectedValue(new Error('502 from World of Books'));
    const { service, warn } = makeService({ scrape });

    const response = await service.scrapeCategoryBySlug('author-books-by-agatha-christie');

    expect(response.products).toEqual([]);
    expect(response.total).toBe(0);
    expect(warn.mock.calls.map((call) => call[0]).join('\n')).toContain('Inline scrape');
  });

  /**
   * `jobQueued` means "the queue accepted the job", so on an unreachable queue it is false for
   * categories with pages left. The message must not read that as completion — a response
   * claiming `fully scraped` beside `is_exhausted: false` is how this was noticed.
   */
  it('never claims a category is fully scraped while it has pages left', async () => {
    const stored = [{ id: 1 }] as unknown as Product[];
    const { service } = makeService({ reads: [[stored, 40]], category: { is_exhausted: false } });

    const response = await service.scrapeCategoryBySlug('author-books-by-agatha-christie');

    expect(response.jobQueued).toBe(false);
    expect(response.message).not.toContain('fully scraped');
  });

  it('marks the category exhausted when the feed says the collection has ended', async () => {
    const scrape = jest
      .fn()
      .mockResolvedValue({ ...result, nextPage: null, exhausted: true } as CategoryScrapeResult);
    const { service, category } = makeService({ scrape });

    await service.scrapeCategoryBySlug('author-books-by-agatha-christie');

    expect(category.is_exhausted).toBe(true);
  });
});
