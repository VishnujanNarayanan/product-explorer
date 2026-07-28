/**
 * Fallback seed script.
 *
 * Loads `backend/database/seed-data.json` — real World of Books data captured from the live
 * site — into navigation → category → product → product_detail, so the app can be reviewed
 * end to end even if scraping is blocked or the site's markup drifts.
 *
 *   npm run seed            upsert the fixture (safe to re-run)
 *   npm run seed -- --reset delete seeded rows first, then upsert
 *
 * `review` is left empty on purpose: World of Books publishes no review or rating markup, and
 * the assignment asks for reviews "if present". Inventing them would put fabricated content in
 * front of users.
 */
import 'reflect-metadata';
import { DataSource, In } from 'typeorm';
import { readFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import { Navigation } from '../entities/navigation.entity';
import { Category } from '../entities/category.entity';
import { Product } from '../entities/product.entity';
import { ProductDetail } from '../entities/product-detail.entity';
// Product declares a `reviews` relation, so Review has to be registered even though the seed
// never writes one.
import { Review } from '../entities/review.entity';

// The backend reads .env from the repository root, one level above backend/.
config({ path: join(__dirname, '..', '..', '..', '.env') });
config({ path: join(__dirname, '..', '..', '.env') });

/** From src/database or dist/database, `../../database` is always backend/database. */
const FIXTURE_PATH = join(__dirname, '..', '..', 'database', 'seed-data.json');

interface Fixture {
  captured_at: string;
  navigation: { title: string; slug: string }[];
  categories: {
    title: string;
    slug: string;
    navigation_slug: string;
    last_page_scraped: number;
    is_exhausted: boolean;
  }[];
  products: {
    source_id: string;
    title: string;
    author: string | null;
    price: number;
    currency: string;
    image_url: string;
    source_url: string;
    category_slug: string;
  }[];
  product_details: {
    source_id: string;
    description: string;
    specs: Record<string, unknown>;
  }[];
}

function loadFixture(): Fixture {
  try {
    return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
  } catch (err: any) {
    throw new Error(
      `Could not read seed fixture at ${FIXTURE_PATH}: ${err.message}\n` +
        'Regenerate it with `npx ts-node build-seed-fixture.ts` (requires a scraped database).',
    );
  }
}

function createDataSource(): DataSource {
  return new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'admin',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_DATABASE || 'wob_explorer',
    entities: [Navigation, Category, Product, ProductDetail, Review],
    synchronize: false,
    logging: false,
  });
}

async function seed(ds: DataSource, fixture: Fixture, reset: boolean) {
  const navRepo = ds.getRepository(Navigation);
  const catRepo = ds.getRepository(Category);
  const productRepo = ds.getRepository(Product);
  const detailRepo = ds.getRepository(ProductDetail);

  if (reset) {
    // Child-first so foreign keys stay satisfied. `review` is included only to clear rows a
    // previous experiment may have left behind — the seed never writes any.
    console.log('--reset: clearing seeded tables');
    await ds.query(
      'TRUNCATE product_detail, review, product, category, navigation RESTART IDENTITY CASCADE',
    );
  }

  // ---------- navigation ----------
  await navRepo.upsert(
    fixture.navigation.map((n) => ({ ...n, last_scraped_at: new Date() })),
    ['slug'],
  );
  const navBySlug = new Map(
    (await navRepo.find()).map((n) => [n.slug, n]),
  );
  console.log(`navigation: ${navBySlug.size} rows`);

  // ---------- categories ----------
  // Keyed by (navigation, slug): the same collection is listed under more than one heading
  // and each listing is its own row, so the slug alone cannot identify one.
  for (const c of fixture.categories) {
    const navigation = navBySlug.get(c.navigation_slug);
    if (!navigation) {
      console.warn(`  ! category "${c.slug}" references unknown navigation "${c.navigation_slug}"`);
      continue;
    }
    const existing = await catRepo.findOne({
      where: { slug: c.slug, navigation: { id: navigation.id } },
    });
    await catRepo.save({
      ...(existing ?? {}),
      title: c.title,
      slug: c.slug,
      last_page_scraped: c.last_page_scraped,
      is_exhausted: c.is_exhausted,
      last_scraped_at: new Date(),
      navigation: { id: navigation.id },
    } as any);
  }
  const categories = await catRepo.find({ relations: ['navigation'] });
  const catByKey = new Map(
    categories.map((c) => [`${c.navigation?.slug ?? ''}|${c.slug}`, c]),
  );
  // Fixture products name a category by slug alone; without a heading the first listing wins.
  const catBySlug = new Map<string, (typeof categories)[number]>();
  for (const c of [...categories].sort((a, b) => a.id - b.id)) {
    if (!catBySlug.has(c.slug)) catBySlug.set(c.slug, c);
  }
  console.log(`categories: ${catByKey.size} rows`);

  // ---------- products ----------
  let inserted = 0;
  let skipped = 0;
  for (const p of fixture.products) {
    const category = catBySlug.get(p.category_slug);
    if (!category) {
      console.warn(`  ! product "${p.source_id}" references unknown category "${p.category_slug}"`);
      skipped++;
      continue;
    }
    try {
      // Matched within the category — source_id is unique per category, not globally.
      const existing = await productRepo.findOne({
        where: { source_id: p.source_id, category: { id: category.id } },
      });
      await productRepo.save({
        ...(existing ?? {}),
        source_id: p.source_id,
        title: p.title,
        author: p.author,
        price: p.price,
        currency: p.currency,
        image_url: p.image_url,
        source_url: p.source_url,
        last_scraped_at: new Date(),
        category: { id: category.id },
      } as any);
      inserted++;
    } catch (err: any) {
      // Any surviving uniqueness clash means a row already stands for this product in this
      // category; keep what is stored rather than fighting the constraint.
      if (err?.code === '23505') {
        skipped++;
        continue;
      }
      throw err;
    }
  }
  console.log(`products: ${inserted} upserted, ${skipped} skipped`);

  // ---------- product detail ----------
  const detailSourceIds = fixture.product_details.map((d) => d.source_id);
  // A product can exist once per category; detail belongs to the oldest copy, which is the
  // row the detail endpoint resolves a source_id to.
  const productIdBySourceId = new Map<string, number>();
  for (const p of await productRepo.find({
    where: { source_id: In(detailSourceIds.length ? detailSourceIds : ['']) },
    select: ['id', 'source_id'],
    order: { id: 'ASC' },
  })) {
    if (!productIdBySourceId.has(p.source_id)) productIdBySourceId.set(p.source_id, p.id);
  }

  let details = 0;
  for (const d of fixture.product_details) {
    const productId = productIdBySourceId.get(d.source_id);
    if (!productId) continue;
    await detailRepo.upsert(
      [
        {
          product_id: productId,
          description: d.description,
          specs: d.specs,
          // Left null/0 deliberately — see the file header.
          ratings_avg: null,
          reviews_count: 0,
        } as any,
      ],
      ['product_id'],
    );
    details++;
  }
  console.log(`product details: ${details} rows`);

  const reviews = await ds.query('SELECT COUNT(*)::int AS n FROM review');
  console.log(`reviews: ${reviews[0].n} rows (intentionally empty)`);
}

async function main() {
  const reset = process.argv.includes('--reset');
  const fixture = loadFixture();
  console.log(
    `Seeding from fixture captured ${fixture.captured_at} ` +
      `(${fixture.navigation.length} headings, ${fixture.categories.length} categories, ` +
      `${fixture.products.length} products, ${fixture.product_details.length} details)`,
  );

  const ds = createDataSource();
  await ds.initialize();
  try {
    await seed(ds, fixture, reset);
    console.log('\nSeed complete.');
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error(`\nSeed failed: ${err.message}`);
  process.exit(1);
});
