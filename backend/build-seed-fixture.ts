/**
 * One-off generator for backend/database/seed-data.json.
 *
 * Not part of the running app and not needed by reviewers — it exists so the committed seed
 * fixture is demonstrably *real* World of Books data rather than invented rows. It reads the
 * navigation tree already scraped into the local database, pulls a listing page for a handful
 * of categories spanning every navigation heading, and scrapes detail pages for a sample of
 * products.
 *
 * Run (with postgres up and the nav tree already scraped):
 *   npx ts-node build-seed-fixture.ts
 */
import { DataSource } from 'typeorm';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import { CategoryScraper } from './src/modules/scraper/scrapers/category.scraper';
import { ProductDetailScraper } from './src/modules/scraper/scrapers/product-detail.scraper';

config({ path: join(__dirname, '..', '.env') });

/** Categories to seed products into — at least one per navigation heading. */
const SEED_CATEGORIES = [
  'tiktok-uk',
  'summer-reads-under-4',
  'crime-and-mystery-books',
  'fantasy-fiction-books',
  'thriller-and-suspense-books',
  'biography-and-true-story-books',
  'cookbooks-and-recipe-books',
  'childrens-fiction-books',
  'author-books-by-roald-dahl',
  'rare-crime-books',
  'rare-science-books',
  'dvd-comedy-films',
  'classical-cds',
];

const PRODUCTS_PER_CATEGORY = 40;
/** How many products per category to scrape full detail pages for. */
const DETAIL_SAMPLE_PER_CATEGORY = 3;

const OUT_PATH = join(__dirname, 'database', 'seed-data.json');

async function main() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'admin',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_DATABASE || 'wob_explorer',
  });
  await ds.initialize();

  const navigation: any[] = await ds.query(
    'SELECT title, slug FROM navigation ORDER BY id',
  );
  const categories: any[] = await ds.query(
    `SELECT c.title, c.slug, n.slug AS navigation_slug
       FROM category c JOIN navigation n ON n.id = c.navigation_id
      ORDER BY n.id, c.title`,
  );
  await ds.destroy();

  console.log(`navigation: ${navigation.length}, categories: ${categories.length}`);

  const catScraper = new CategoryScraper();
  const detailScraper = new ProductDetailScraper();

  // Detail scrapes are the fragile part — a single slow page load loses that product. Carry
  // over anything a previous run already captured so re-running tops the fixture up instead
  // of re-fetching pages the site has already served us.
  const previous = existsSync(OUT_PATH)
    ? JSON.parse(readFileSync(OUT_PATH, 'utf8'))
    : { product_details: [] };
  const details: any[] = [...(previous.product_details ?? [])];
  const haveDetail = new Set<string>(details.map((d: any) => d.source_id));
  console.log(`carried over ${details.length} existing product details`);

  const products: any[] = [];
  const seenProduct = new Set<string>();
  const categoryState: Record<string, { last_page_scraped: number; is_exhausted: boolean }> = {};
  const detailTargets: { url: string; source_id: string }[] = [];

  for (const slug of SEED_CATEGORIES) {
    if (!categories.some((c) => c.slug === slug)) {
      console.warn(`  ! ${slug} not in category table — skipping`);
      continue;
    }
    try {
      const res = await catScraper.scrape(slug, {
        startPage: 1,
        maxPages: 1,
        pageSize: PRODUCTS_PER_CATEGORY,
      });
      console.log(`  ${slug}: ${res.products.length} products (exhausted=${res.exhausted})`);
      categoryState[slug] = { last_page_scraped: 1, is_exhausted: res.exhausted };

      // A title can appear in several collections, but `product.source_id` is unique and a
      // product carries one category FK. First collection to list it wins, matching what the
      // scraper pipeline does at runtime.
      const kept: typeof res.products = [];
      for (const p of res.products) {
        if (seenProduct.has(p.source_id)) continue;
        seenProduct.add(p.source_id);
        kept.push(p);
        products.push({
          source_id: p.source_id,
          title: p.title,
          author: p.author,
          price: p.price,
          currency: p.currency,
          image_url: p.image_url,
          source_url: p.source_url,
          category_slug: slug,
        });
      }

      detailTargets.push(
        ...kept
          .filter((p) => !haveDetail.has(p.source_id))
          .slice(0, DETAIL_SAMPLE_PER_CATEGORY)
          .map((p) => ({ url: p.source_url, source_id: p.source_id })),
      );
    } catch (err: any) {
      console.warn(`  ! ${slug} listing failed: ${err.message}`);
    }
  }

  console.log(`\nscraping ${detailTargets.length} detail pages...`);
  for (const t of detailTargets) {
    try {
      const d = await detailScraper.scrape(t.url, t.source_id);
      if (!d.description) {
        console.warn(`  ! ${t.source_id} has no description — skipping`);
        continue;
      }
      // The detail page reports the canonical Shopify id; trust the listing id we asked for,
      // so the detail always joins back to a product row in the fixture.
      details.push({
        source_id: t.source_id,
        description: d.description,
        specs: d.specs,
        // ratings_avg / reviews_count deliberately omitted: World of Books publishes no
        // review or rating markup, and inventing them would put fabricated data in the UI.
      });
      haveDetail.add(t.source_id);
      console.log(`  ${t.source_id}: "${d.title}" (${d.description.length} chars)`);
    } catch (err: any) {
      console.warn(`  ! detail failed for ${t.url}: ${err.message}`);
    }
  }

  const fixture = {
    _comment:
      'Real World of Books data captured from the live site. Regenerate with ' +
      '`npx ts-node build-seed-fixture.ts`. Reviews are intentionally absent: World of Books ' +
      'publishes no review or rating markup.',
    captured_at: new Date().toISOString(),
    navigation,
    categories: categories.map((c) => ({
      ...c,
      ...(categoryState[c.slug] ?? { last_page_scraped: 0, is_exhausted: false }),
    })),
    products,
    // Drop details carried over from a run that seeded different categories — every detail
    // must join to a product row.
    product_details: details.filter((d) => seenProduct.has(d.source_id)),
  };

  writeFileSync(OUT_PATH, JSON.stringify(fixture, null, 2));
  console.log(
    `\nwrote ${OUT_PATH}\n  navigation=${navigation.length} categories=${categories.length} ` +
      `products=${products.length} details=${fixture.product_details.length}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
