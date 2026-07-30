import { Logger } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { Product } from '../../entities/product.entity';

/**
 * Redis backs a cache and a job queue, both optimisations. Reading products that are already
 * in Postgres used to depend on it anyway: an unreachable Redis made the cache lookup hang
 * until the client exhausted its retries — 90 seconds in the deployment where this was found —
 * and the request then failed with a 500, for data sitting in the database the whole time.
 *
 * These tests pin down that a Redis outage degrades to a plain database read.
 */
describe('ScraperService with Redis unavailable', () => {
  const category = { id: 7, slug: 'fiction-books', is_exhausted: false, navigation: null };
  const stored = [{ id: 1, title: 'Stored book' }] as unknown as Product[];

  /** Enough of the service to drive scrapeCategoryBySlug without the Nest container. */
  function makeService(redis: {
    get?: jest.Mock;
    set?: jest.Mock;
    add?: jest.Mock;
  }) {
    const service = Object.create(ScraperService.prototype) as ScraperService;
    const warn = jest.fn();

    const fields: Record<string, unknown> = {
      logger: { log: jest.fn(), error: jest.fn(), warn } as unknown as Logger,
      cacheManager: {
        get: redis.get ?? jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
        set: redis.set ?? jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
        del: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      },
      scrapingQueue: {
        add: redis.add ?? jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      },
      categoryRepo: { findOne: jest.fn().mockResolvedValue(category) },
      productRepo: { findAndCount: jest.fn().mockResolvedValue([stored, 1]) },
      redisDegraded: false,
    };

    for (const [key, value] of Object.entries(fields)) {
      Object.defineProperty(service, key, { value, writable: true });
    }

    return { service, warn };
  }

  it('serves stored products when the cache and the queue both fail', async () => {
    const { service } = makeService({});

    const result = await service.scrapeCategoryBySlug('fiction-books', { limit: 24 });

    expect(result.products).toEqual(stored);
    expect(result.total).toBe(1);
  });

  it('reports jobQueued false rather than promising an update that cannot arrive', async () => {
    const { service } = makeService({});

    const result = await service.scrapeCategoryBySlug('fiction-books');

    // The category is not exhausted, so a reachable queue would have taken a job here.
    expect(result.jobQueued).toBe(false);
  });

  it('logs the outage once, not once per request', async () => {
    const { service, warn } = makeService({});

    await service.scrapeCategoryBySlug('fiction-books');
    await service.scrapeCategoryBySlug('fiction-books');
    await service.scrapeCategoryBySlug('fiction-books');

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('Redis unavailable');
  });

  it('gives up on a cache read that never settles instead of waiting on it', async () => {
    jest.useFakeTimers();

    try {
      // A client with an offline queue does this: the promise neither resolves nor rejects
      // while Redis is down. Without a timeout the request hangs behind it forever.
      const { service } = makeService({ get: jest.fn().mockReturnValue(new Promise(() => {})) });

      const pending = service.scrapeCategoryBySlug('fiction-books');
      await jest.advanceTimersByTimeAsync(2000);

      await expect(pending).resolves.toMatchObject({ products: stored });
    } finally {
      jest.useRealTimers();
    }
  });

  it('still uses the cache when Redis is healthy', async () => {
    const cached = { products: [{ id: 99 }], category, total: 1 };
    const get = jest.fn().mockResolvedValue(cached);
    const add = jest.fn().mockResolvedValue({ id: 'job-1' });
    const { service, warn } = makeService({ get, add });

    const result = await service.scrapeCategoryBySlug('fiction-books');

    expect(result.products).toEqual(cached.products);
    expect(warn).not.toHaveBeenCalled();
  });
});
