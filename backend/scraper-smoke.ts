/**
 * Standalone smoke test for the scrapers — no database, no Nest.
 * Run: npx ts-node scraper-smoke.ts
 */
import { NavigationScraper } from './src/modules/scraper/scrapers/navigation.scraper';
import { CategoryScraper } from './src/modules/scraper/scrapers/category.scraper';
import { ProductDetailScraper } from './src/modules/scraper/scrapers/product-detail.scraper';

async function main() {
  const which = process.argv[2] || 'all';

  if (which === 'all' || which === 'nav') {
    console.log('\n========== NAVIGATION ==========');
    const nav = new NavigationScraper();
    const { navigation, categories } = await nav.scrape();
    console.log(`navigation headings: ${navigation.length}`);
    navigation.forEach((n) => console.log(`   ■ ${n.title}  (${n.slug})  ${n.url}`));
    console.log(`categories: ${categories.length}`);
    categories.slice(0, 8).forEach((c) => console.log(`   - ${c.title}  [${c.slug}]  parent=${c.parentSlug}`));
  }

  if (which === 'all' || which === 'cat') {
    console.log('\n========== CATEGORY LISTING (page 1) ==========');
    const cat = new CategoryScraper();
    const res = await cat.scrape('fiction-books', { startPage: 1, maxPages: 1 });
    console.log(`products: ${res.products.length}  pagesFetched=${res.pagesFetched}  nextPage=${res.nextPage}  exhausted=${res.exhausted}`);
    res.products.slice(0, 5).forEach((p) =>
      console.log(`   - [${p.source_id}] "${p.title}" by ${p.author} — £${p.price} — ${p.image_url ? 'img' : 'NO IMG'}`),
    );
    const missingAuthor = res.products.filter((p) => !p.author).length;
    const missingImage = res.products.filter((p) => !p.image_url).length;
    const zeroPrice = res.products.filter((p) => !p.price).length;
    console.log(`   quality: missing author=${missingAuthor}, missing image=${missingImage}, zero price=${zeroPrice}`);

    console.log('\n---------- checkpoint resume (page 2) ----------');
    const res2 = await cat.scrape('fiction-books', { startPage: 2, maxPages: 1 });
    console.log(`page2 products: ${res2.products.length}  nextPage=${res2.nextPage}`);
    const overlap = res2.products.filter((p) => res.products.some((q) => q.source_id === p.source_id)).length;
    console.log(`   overlap with page 1: ${overlap} (expect 0)`);
  }

  if (which === 'all' || which === 'detail') {
    console.log('\n========== PRODUCT DETAIL ==========');
    const det = new ProductDetailScraper();
    const d = await det.scrape(
      'https://www.worldofbooks.com/en-gb/products/housemaid-book-freida-mcfadden-9781408728512',
    );
    console.log(`source_id:   ${d.source_id}`);
    console.log(`title:       ${d.title}`);
    console.log(`author:      ${d.author}`);
    console.log(`image:       ${d.image_url}`);
    console.log(`ratings_avg: ${d.ratings_avg}  reviews_count: ${d.reviews_count}`);
    console.log(`description: ${d.description.slice(0, 160)}...  (${d.description.length} chars)`);
    console.log(`specs:       ${JSON.stringify(d.specs)}`);
    console.log(`related (${d.related_products.length}):`);
    d.related_products.forEach((r) => console.log(`   - "${r.title}" by ${r.author} £${r.price}`));
  }

  console.log('\nDONE');
}

main().catch((e) => {
  console.error('SMOKE FAILED:', e);
  process.exit(1);
});
