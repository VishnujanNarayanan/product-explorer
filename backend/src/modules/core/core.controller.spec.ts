import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CoreController } from './core.controller';
import { CoreService } from './core.service';
import { ScraperService } from '../scraper/scraper.service';
import { LegacyScrapeType } from './dto';

describe('CoreController', () => {
  let controller: CoreController;
  let coreService: jest.Mocked<Partial<CoreService>>;
  let scraperService: jest.Mocked<Partial<ScraperService>>;

  beforeEach(async () => {
    coreService = {
      getNavigation: jest.fn().mockResolvedValue([{ id: 1, title: 'Fiction Books' }]),
      getCategoriesByNavigation: jest.fn().mockResolvedValue([]),
      getAllCategories: jest.fn().mockResolvedValue([]),
      getCategoryBySlug: jest.fn().mockResolvedValue(null),
      getProducts: jest
        .fn()
        .mockResolvedValue({ products: [], total: 0, page: 1, limit: 24, hasMore: false }),
      healthCheck: jest.fn().mockResolvedValue({ status: 'OK' }),
    } as never;

    scraperService = {
      scrapeAndSaveNavigation: jest.fn().mockResolvedValue([]),
      scrapeCategoryBySlug: jest.fn().mockResolvedValue({ products: [], total: 0 }),
      scrapeProductBySourceId: jest.fn().mockResolvedValue(null),
      getScrapeJobStatus: jest.fn().mockResolvedValue(null),
      triggerOnDemandScrape: jest.fn().mockResolvedValue({ success: true }),
      cleanupOldData: jest.fn().mockResolvedValue({ deleted: 0, message: 'none' }),
      clearCache: jest.fn().mockResolvedValue(undefined),
    } as never;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CoreController],
      providers: [
        { provide: CoreService, useValue: coreService },
        { provide: ScraperService, useValue: scraperService },
      ],
    }).compile();

    controller = module.get(CoreController);
  });

  describe('GET /navigation', () => {
    it('serves stored navigation without scraping', async () => {
      const result = await controller.getNavigation();
      expect(result).toHaveLength(1);
      expect(scraperService.scrapeAndSaveNavigation).not.toHaveBeenCalled();
    });

    // A fresh install that has been neither seeded nor scraped should fill itself.
    it('falls back to a scrape when the table is empty', async () => {
      (coreService.getNavigation as jest.Mock).mockResolvedValue([]);
      await controller.getNavigation();
      expect(scraperService.scrapeAndSaveNavigation).toHaveBeenCalled();
    });

    it('reports a database failure as a 500', async () => {
      (coreService.getNavigation as jest.Mock).mockRejectedValue(new Error('connection lost'));
      await expect(controller.getNavigation()).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('GET /categories', () => {
    it('filters by navigation when the query is present', async () => {
      await controller.getCategories({ navigation: 'fiction-books' });
      expect(coreService.getCategoriesByNavigation).toHaveBeenCalledWith('fiction-books');
      expect(coreService.getAllCategories).not.toHaveBeenCalled();
    });

    it('returns every category when the query is absent', async () => {
      await controller.getCategories({});
      expect(coreService.getAllCategories).toHaveBeenCalled();
    });
  });

  describe('GET /categories/:slug', () => {
    // This used to answer 200 with an empty body, which reads as "exists but is blank".
    it('answers 404 for a slug that does not exist', async () => {
      await expect(controller.getCategory({ slug: 'no-such-category' }, {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the category when it exists', async () => {
      (coreService.getCategoryBySlug as jest.Mock).mockResolvedValue({ id: 11, slug: 'fantasy' });
      await expect(controller.getCategory({ slug: 'fantasy' }, {})).resolves.toMatchObject({
        id: 11,
      });
    });

    // The same slug is listed under several headings, so the heading has to reach the service.
    it('scopes the lookup to the navigation heading when one is given', async () => {
      (coreService.getCategoryBySlug as jest.Mock).mockResolvedValue({ id: 12, slug: 'trending-now' });
      await controller.getCategory({ slug: 'trending-now' }, { navigation: 'non-fiction-books' });
      expect(coreService.getCategoryBySlug).toHaveBeenCalledWith(
        'trending-now',
        'non-fiction-books',
      );
    });
  });

  describe('GET /categories/:slug/products', () => {
    it('passes paging through to the scraper service', async () => {
      await controller.getCategoryProducts({ slug: 'fantasy-fiction-books' }, { page: 2, limit: 10 });
      expect(scraperService.scrapeCategoryBySlug).toHaveBeenCalledWith('fantasy-fiction-books', {
        page: 2,
        limit: 10,
        navigationSlug: undefined,
        force: false,
      });
    });

    it('defaults paging when the query omits it', async () => {
      await controller.getCategoryProducts({ slug: 'fantasy-fiction-books' }, {});
      expect(scraperService.scrapeCategoryBySlug).toHaveBeenCalledWith('fantasy-fiction-books', {
        page: 1,
        limit: 24,
        navigationSlug: undefined,
        force: false,
      });
    });

    // Two headings can list the same collection, each with its own products.
    it('passes the navigation heading through when the query carries one', async () => {
      await controller.getCategoryProducts(
        { slug: 'trending-now' },
        { navigation: 'fiction-books' },
      );
      expect(scraperService.scrapeCategoryBySlug).toHaveBeenCalledWith('trending-now', {
        page: 1,
        limit: 24,
        navigationSlug: 'fiction-books',
        force: false,
      });
    });

    // A deliberate 404 from the service must not be reported as a server fault.
    it('propagates a NotFoundException instead of masking it as a 500', async () => {
      (scraperService.scrapeCategoryBySlug as jest.Mock).mockRejectedValue(
        new NotFoundException('Category not found: nope'),
      );
      await expect(controller.getCategoryProducts({ slug: 'nope' }, {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('reports an unexpected failure as a 500', async () => {
      (scraperService.scrapeCategoryBySlug as jest.Mock).mockRejectedValue(new Error('boom'));
      await expect(controller.getCategoryProducts({ slug: 'fantasy' }, {})).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('GET /products', () => {
    it('reads storage without queueing a scrape', async () => {
      const result = await controller.getProducts({ page: 2, limit: 12 });

      expect(coreService.getProducts).toHaveBeenCalledWith(2, 12, false, undefined);
      expect(result.total).toBe(0);
      expect(scraperService.scrapeCategoryBySlug).not.toHaveBeenCalled();
    });

    it('narrows to one collection when a category is given', async () => {
      await controller.getProducts({ category: 'fantasy-fiction-books' });
      expect(coreService.getProducts).toHaveBeenCalledWith(
        undefined,
        undefined,
        false,
        'fantasy-fiction-books',
      );
    });

    // The home shelf asks for a sample; the flag has to survive the controller.
    it('passes the random flag through', async () => {
      await controller.getProducts({ page: 1, limit: 10, random: true });
      expect(coreService.getProducts).toHaveBeenCalledWith(1, 10, true, undefined);
    });

    it('reports a database failure as a 500', async () => {
      (coreService.getProducts as jest.Mock).mockRejectedValue(new Error('connection lost'));
      await expect(controller.getProducts({})).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('GET /products/:sourceId', () => {
    it('answers 404 when the product is unknown', async () => {
      await expect(
        controller.getProduct({ sourceId: '999999999999' }, {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('passes the refresh flag through', async () => {
      (scraperService.scrapeProductBySourceId as jest.Mock).mockResolvedValue({ id: 1 });
      await controller.getProduct({ sourceId: '9846944432401' }, { refresh: true });
      expect(scraperService.scrapeProductBySourceId).toHaveBeenCalledWith('9846944432401', true);
    });

    it('defaults refresh to false', async () => {
      (scraperService.scrapeProductBySourceId as jest.Mock).mockResolvedValue({ id: 1 });
      await controller.getProduct({ sourceId: '9846944432401' }, {});
      expect(scraperService.scrapeProductBySourceId).toHaveBeenCalledWith('9846944432401', false);
    });
  });

  describe('POST /scrape/product/:sourceId', () => {
    it('reports whether detail is already stored', async () => {
      (scraperService.scrapeProductBySourceId as jest.Mock).mockResolvedValue({
        id: 1,
        detail: { description: 'x' },
      });

      const result = await controller.scrapeProduct({ sourceId: '1' }, {});
      expect(result).toMatchObject({ success: true, hasDetails: true, jobQueued: false });
    });

    // No stored detail means a detail scrape is still owed.
    it('marks a job queued when detail is missing', async () => {
      (scraperService.scrapeProductBySourceId as jest.Mock).mockResolvedValue({ id: 1 });
      const result = await controller.scrapeProduct({ sourceId: '1' }, {});
      expect(result).toMatchObject({ hasDetails: false, jobQueued: true });
    });

    it('marks a job queued when a refresh was demanded', async () => {
      (scraperService.scrapeProductBySourceId as jest.Mock).mockResolvedValue({
        id: 1,
        detail: { description: 'x' },
      });
      const result = await controller.scrapeProduct({ sourceId: '1' }, { refresh: true });
      expect(result.jobQueued).toBe(true);
    });

    it('answers 404 rather than a success envelope with a null body', async () => {
      await expect(controller.scrapeProduct({ sourceId: 'nope' }, {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('GET /jobs/:id', () => {
    it('answers 404 for an unknown job', async () => {
      await expect(controller.getJobStatus({ id: 999 })).rejects.toThrow(NotFoundException);
    });

    it('returns the job when it exists', async () => {
      (scraperService.getScrapeJobStatus as jest.Mock).mockResolvedValue({ id: 7, status: 'done' });
      await expect(controller.getJobStatus({ id: 7 })).resolves.toMatchObject({ id: 7 });
    });
  });

  describe('legacy scrape route', () => {
    it('rewrites the "home" keyword to the locale-qualified site root', async () => {
      await controller.triggerScrape({ type: LegacyScrapeType.NAVIGATION, target: 'home' });
      expect(scraperService.triggerOnDemandScrape).toHaveBeenCalledWith(
        'navigation',
        'https://www.worldofbooks.com/en-gb',
      );
    });

    it('passes a category slug through untouched', async () => {
      await controller.triggerScrape({ type: LegacyScrapeType.CATEGORY, target: 'fantasy' });
      expect(scraperService.triggerOnDemandScrape).toHaveBeenCalledWith('category', 'fantasy');
    });
  });

  describe('utility routes', () => {
    it('reports cache clearing', async () => {
      const result = await controller.clearCache();
      expect(result).toMatchObject({ success: true });
      expect(scraperService.clearCache).toHaveBeenCalled();
    });

    it('delegates health to the core service', async () => {
      await expect(controller.healthCheck()).resolves.toMatchObject({ status: 'OK' });
    });
  });
});
