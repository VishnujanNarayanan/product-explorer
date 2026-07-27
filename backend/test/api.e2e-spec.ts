import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Navigation } from '../src/entities/navigation.entity';
import { Category } from '../src/entities/category.entity';
import { Product } from '../src/entities/product.entity';

/**
 * Integration tests. These run the real Nest application against real PostgreSQL and Redis —
 * no repository mocks — so the entities, the schema and the validation pipe are exercised
 * together. CI provides both as service containers.
 *
 *   npm run test:e2e
 *
 * Nothing here touches the network: every route under test reads stored rows, and the fixture
 * is inserted directly. Live scraping is covered by `scraper-smoke.ts` instead.
 */
describe('API (integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // Prefixed so the fixture cannot collide with seeded or scraped rows.
  const NAV_SLUG = 'e2e-fiction';
  const CAT_SLUG = 'e2e-fantasy';
  const EMPTY_CAT_SLUG = 'e2e-empty';
  const SOURCE_IDS = ['e2e-product-1', 'e2e-product-2', 'e2e-product-3'];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Must match main.ts, or these tests would validate a different application.
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    dataSource = app.get(DataSource);
    await seedFixture();
  }, 60_000);

  afterAll(async () => {
    await cleanupFixture();
    await app?.close();
  }, 30_000);

  async function seedFixture() {
    await cleanupFixture();

    const nav = await dataSource
      .getRepository(Navigation)
      .save({ title: 'E2E Fiction', slug: NAV_SLUG });

    const category = await dataSource.getRepository(Category).save({
      title: 'E2E Fantasy',
      slug: CAT_SLUG,
      navigation: nav,
      // Marked exhausted so reading it never queues a scrape against the live site.
      is_exhausted: true,
      last_page_scraped: 1,
    });

    await dataSource.getRepository(Category).save({
      title: 'E2E Empty',
      slug: EMPTY_CAT_SLUG,
      navigation: nav,
      is_exhausted: true,
    });

    await dataSource.getRepository(Product).save(
      SOURCE_IDS.map((sourceId, i) => ({
        source_id: sourceId,
        title: `E2E Product ${i + 1}`,
        author: 'E2E Author',
        price: 3.5 + i,
        currency: 'GBP',
        image_url: 'https://cdn.shopify.com/s/files/1/0784/4072/6801/files/example.jpg',
        source_url: `https://www.worldofbooks.com/en-gb/products/${sourceId}`,
        category,
      })),
    );
  }

  async function cleanupFixture() {
    if (!dataSource?.isInitialized) return;
    await dataSource.query('DELETE FROM product_detail WHERE product_id IN (SELECT id FROM product WHERE source_id LIKE $1)', ['e2e-%']);
    await dataSource.query('DELETE FROM product WHERE source_id LIKE $1', ['e2e-%']);
    await dataSource.query('DELETE FROM category WHERE slug LIKE $1', ['e2e-%']);
    await dataSource.query('DELETE FROM navigation WHERE slug LIKE $1', ['e2e-%']);
  }

  describe('GET /api/health', () => {
    it('reports the database as reachable', async () => {
      const res = await request(app.getHttpServer()).get('/api/health').expect(200);
      expect(res.body.status).toBe('OK');
      expect(res.body.services.database).toBe('OK');
    });
  });

  describe('GET /api/navigation', () => {
    it('returns headings with their categories', async () => {
      const res = await request(app.getHttpServer()).get('/api/navigation').expect(200);
      expect(Array.isArray(res.body)).toBe(true);

      const nav = res.body.find((n: { slug: string }) => n.slug === NAV_SLUG);
      expect(nav).toBeDefined();
      expect(nav.title).toBe('E2E Fiction');
      expect(nav.categories.map((c: { slug: string }) => c.slug)).toEqual(
        expect.arrayContaining([CAT_SLUG, EMPTY_CAT_SLUG]),
      );
    });
  });

  describe('GET /api/categories', () => {
    it('filters to one navigation heading', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/categories?navigation=${NAV_SLUG}`)
        .expect(200);

      const slugs = res.body.map((c: { slug: string }) => c.slug);
      expect(slugs).toEqual(expect.arrayContaining([CAT_SLUG, EMPTY_CAT_SLUG]));
    });

    it('rejects a malformed navigation slug', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/categories?navigation=NOT../A/SLUG')
        .expect(400);
      expect(res.body.message.join(' ')).toContain('navigation must be lowercase');
    });

    it('rejects an undeclared query parameter', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/categories?bogusParam=1')
        .expect(400);
      expect(res.body.message.join(' ')).toContain('should not exist');
    });
  });

  describe('GET /api/categories/:slug', () => {
    it('returns the category', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/categories/${CAT_SLUG}`)
        .expect(200);
      expect(res.body.slug).toBe(CAT_SLUG);
    });

    it('answers 404 for a slug that does not exist', async () => {
      await request(app.getHttpServer()).get('/api/categories/e2e-no-such-thing').expect(404);
    });
  });

  describe('GET /api/products', () => {
    it('returns a paged envelope rather than a bare array', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/products?category=${CAT_SLUG}`)
        .expect(200);

      expect(res.body).toMatchObject({ page: 1, limit: 24 });
      expect(Array.isArray(res.body.products)).toBe(true);
      expect(res.body.total).toBe(SOURCE_IDS.length);
      expect(res.body.hasMore).toBe(false);
    });

    it('pages through results without repeating a row', async () => {
      const first = await request(app.getHttpServer())
        .get(`/api/products?category=${CAT_SLUG}&page=1&limit=2`)
        .expect(200);
      const second = await request(app.getHttpServer())
        .get(`/api/products?category=${CAT_SLUG}&page=2&limit=2`)
        .expect(200);

      expect(first.body.products).toHaveLength(2);
      expect(first.body.hasMore).toBe(true);
      expect(second.body.products).toHaveLength(1);
      expect(second.body.hasMore).toBe(false);

      const firstIds = first.body.products.map((p: { source_id: string }) => p.source_id);
      const secondIds = second.body.products.map((p: { source_id: string }) => p.source_id);
      expect(firstIds.filter((id: string) => secondIds.includes(id))).toHaveLength(0);
    });

    it('returns an empty page for a category with no products', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/products?category=${EMPTY_CAT_SLUG}`)
        .expect(200);
      expect(res.body.products).toEqual([]);
      expect(res.body.total).toBe(0);
    });

    it.each([
      ['?limit=9999', 'limit may not exceed 100'],
      ['?page=0', 'page must be 1 or greater'],
      ['?page=abc', 'page must be an integer'],
      ['?category=Bad_Slug!', 'category must be lowercase'],
    ])('rejects %s', async (query, expected) => {
      const res = await request(app.getHttpServer()).get(`/api/products${query}`).expect(400);
      expect(res.body.message.join(' ')).toContain(expected);
    });
  });

  describe('GET /api/categories/:slug/products', () => {
    it('returns products with paging metadata and queues nothing for an exhausted category', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/categories/${CAT_SLUG}/products?limit=2`)
        .expect(200);

      expect(res.body.products).toHaveLength(2);
      expect(res.body.total).toBe(SOURCE_IDS.length);
      // An exhausted collection must not issue further requests to World of Books.
      expect(res.body.jobQueued).toBe(false);
    });

    it('serves page 2 rather than a cached page 1', async () => {
      const p1 = await request(app.getHttpServer())
        .get(`/api/categories/${CAT_SLUG}/products?page=1&limit=1`)
        .expect(200);
      const p2 = await request(app.getHttpServer())
        .get(`/api/categories/${CAT_SLUG}/products?page=2&limit=1`)
        .expect(200);

      expect(p1.body.products[0].source_id).not.toBe(p2.body.products[0].source_id);
      expect(p2.body.page).toBe(2);
    });

    it('answers 404 for an unknown category', async () => {
      await request(app.getHttpServer())
        .get('/api/categories/e2e-missing/products')
        .expect(404);
    });
  });

  describe('GET /api/products/:sourceId', () => {
    it('returns a stored product', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/products/${SOURCE_IDS[0]}`)
        .expect(200);

      expect(res.body.source_id).toBe(SOURCE_IDS[0]);
      expect(res.body.title).toBe('E2E Product 1');
      // Reviews and ratings stay empty on purpose — the source publishes neither.
      expect(res.body.detail?.ratings_avg ?? null).toBeNull();
      expect(res.body.reviews ?? []).toEqual([]);
    });

    it('rejects a malformed source id', async () => {
      const res = await request(app.getHttpServer()).get('/api/products/bad%20id').expect(400);
      expect(res.body.message.join(' ')).toContain('sourceId');
    });
  });

  describe('GET /api/jobs/:id', () => {
    it('rejects a non-numeric id', async () => {
      const res = await request(app.getHttpServer()).get('/api/jobs/notanumber').expect(400);
      expect(res.body.message.join(' ')).toContain('id must be an integer');
    });

    it('answers 404 for an unknown job', async () => {
      await request(app.getHttpServer()).get('/api/jobs/999999').expect(404);
    });
  });

  describe('OpenAPI', () => {
    it('the schema.sql-built database satisfies every entity column', async () => {
      // Guards the drift that broke production once: ScrapeJob declared result_count while
      // schema.sql did not define it, which synchronize masked in development.
      for (const meta of dataSource.entityMetadatas) {
        const columns: { column_name: string }[] = await dataSource.query(
          'SELECT column_name FROM information_schema.columns WHERE table_name = $1',
          [meta.tableName],
        );
        const present = new Set(columns.map((c) => c.column_name));
        const expected = meta.columns.map((c) => c.databaseName);
        const missing = expected.filter((c) => !present.has(c));

        expect({ table: meta.tableName, missing }).toEqual({
          table: meta.tableName,
          missing: [],
        });
      }
    });
  });
});
