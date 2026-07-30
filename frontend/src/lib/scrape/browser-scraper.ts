/**
 * Scrapes a World of Books collection from the visitor's own browser.
 *
 * World of Books is a Shopify storefront, and Shopify publishes every collection as JSON at
 * `/collections/<slug>/products.json` with `access-control-allow-origin: *` — an explicit
 * invitation for any page to read it. So the fetch can happen here rather than on the server:
 * on the visitor's connection, in their RAM, visible in their own network tab.
 *
 * That matters because the server cannot always do this work. A small instance has no room for
 * a headless browser, and a queue may not be running. Scraping in the client scales with the
 * number of visitors instead of contending for one process.
 *
 * The results are for display only. The server keeps its own copy by scraping the same feed
 * itself, because anything a browser posts back is unverifiable — a page could claim any book at
 * any price. Trusting it would put fabricated data in the catalogue.
 */

const SITE_ROOT = 'https://www.worldofbooks.com';
/** All content sits under a locale prefix; omitting it redirects. */
const LOCALE = '/en-gb';

/** How long to wait before giving up and letting the server's copy answer instead. */
const TIMEOUT_MS = 8000;

/** Matches the fields the product grid reads, so scraped rows render like stored ones. */
export interface ScrapedProduct {
  source_id: string;
  title: string;
  author: string | null;
  price: number;
  currency: string;
  image_url: string;
  source_url: string;
  /** Distinguishes a row fetched by this browser from one the server had stored. */
  scraped_in_browser: true;
}

/** The subset of Shopify's product shape this reads. */
interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  vendor?: string;
  images?: { src: string }[];
  variants?: { price: string; available?: boolean }[];
}

export function collectionFeedUrl(slug: string, limit = 40, page = 1): string {
  return `${SITE_ROOT}${LOCALE}/collections/${slug}/products.json?limit=${limit}&page=${page}`;
}

/**
 * products.json has no author field — `vendor` is always "WoB" — but the handle encodes it as
 * "<title>-<format>-<author>-<isbn|openlibrary-id>".
 *
 * Deliberately the same rule as the server's `parseAuthorFromHandle`, down to the format list and
 * the two-letter uppercasing. The two run over the same feed, and a browser-scraped row sits in
 * the same grid as a stored one — an author derived differently here would show the same book
 * under two names depending on who fetched it.
 */
export function authorFromHandle(handle: string): string | null {
  if (!handle) return null;

  const match = handle.match(
    /^.*?-(?:book|books|cd|cds|dvd|dvds|vinyl|blu-ray|audio)-(.+)-(?:\d{9,13}|ol\d+[a-z]?)$/i,
  );
  if (!match) return null;

  return match[1]
    .split('-')
    .filter(Boolean)
    .map((word) =>
      word.length <= 2 ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');
}

/**
 * A title carries one variant per condition and location, and the listing shows the cheapest
 * copy that is actually in stock — falling back to the cheapest of any, so a title with nothing
 * available still shows a price rather than nothing. Mirrors the server's `lowestVariantPrice`.
 */
export function lowestVariantPrice(variants: ShopifyProduct['variants']): number {
  if (!Array.isArray(variants) || variants.length === 0) return 0;

  const prices = (availableOnly: boolean) =>
    variants
      .filter((variant) => (availableOnly ? variant?.available : true))
      .map((variant) => parseFloat(variant?.price))
      .filter((price) => !isNaN(price) && price > 0);

  const inStock = prices(true);
  const pool = inStock.length > 0 ? inStock : prices(false);

  return pool.length > 0 ? Math.min(...pool) : 0;
}

function toProduct(raw: ShopifyProduct): ScrapedProduct | null {
  // Without an id there is nothing to reconcile against a stored row, and without a title
  // there is nothing to show.
  if (!raw?.id || !raw?.title) return null;

  return {
    source_id: String(raw.id),
    title: String(raw.title).trim(),
    author: authorFromHandle(raw.handle ?? ''),
    price: lowestVariantPrice(raw.variants),
    currency: 'GBP', // The /en-gb storefront; the feed carries no currency field.
    image_url: raw.images?.[0]?.src ?? '',
    source_url: `${SITE_ROOT}${LOCALE}/products/${raw.handle}`,
    scraped_in_browser: true,
  };
}

export interface BrowserScrapeResult {
  products: ScrapedProduct[];
  /** How long the visitor's browser took, for showing that this really happened here. */
  durationMs: number;
  feedUrl: string;
}

/**
 * Fetches one page of a collection. Rejects on a network error, a non-200, or the timeout —
 * callers treat any failure as "no results from here" and fall back to the server.
 */
export async function scrapeCollectionInBrowser(
  slug: string,
  options: { limit?: number; page?: number; signal?: AbortSignal } = {},
): Promise<BrowserScrapeResult> {
  const feedUrl = collectionFeedUrl(slug, options.limit ?? 40, options.page ?? 1);
  const startedAt = Date.now();

  // Its own timeout, combined with any caller-supplied signal, so a slow feed cannot hold the
  // grid empty indefinitely.
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);
  options.signal?.addEventListener('abort', () => timeout.abort(), { once: true });

  try {
    const response = await fetch(feedUrl, {
      signal: timeout.signal,
      // No credentials: this is a public feed, and sending cookies would make the request
      // non-simple and require a preflight the storefront does not answer.
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`World of Books returned ${response.status} for ${slug}`);
    }

    const body = (await response.json()) as { products?: ShopifyProduct[] };
    const products = (body.products ?? [])
      .map(toProduct)
      .filter((product): product is ScrapedProduct => product !== null);

    return { products, durationMs: Date.now() - startedAt, feedUrl };
  } finally {
    clearTimeout(timer);
  }
}
