import {
  authorFromHandle,
  lowestVariantPrice,
  collectionFeedUrl,
  scrapeCollectionInBrowser,
} from './browser-scraper';

/**
 * Fixtures are real entries from
 * `worldofbooks.com/en-gb/collections/author-books-by-agatha-christie/products.json`, kept
 * verbatim so the parser is pinned against the shape the storefront actually serves rather than
 * an idealised one. Between them they cover a title with stock, a title with none, and a title
 * carrying a £0.00 variant.
 */
const FEED = {
  products: [
    {
      id: 9810968609041,
      title: 'The Murder of Roger Ackroyd',
      handle: 'murder-of-roger-ackroyd-book-agatha-christie-9780007527526',
      images: [{ src: 'https://cdn.shopify.com/s/files/1/0784/4072/6801/files/0007527527.jpg' }],
      variants: [
        { price: '7.90', available: true },
        { price: '7.50', available: true },
        { price: '8.30', available: true },
      ],
    },
    {
      id: 9810968641809,
      title: 'And Then There Were None',
      handle: 'and-then-there-were-none-book-agatha-christie-9780007136834',
      images: [{ src: 'https://cdn.shopify.com/s/files/1/0784/4072/6801/files/0007136838.jpg' }],
      variants: [
        { price: '6.00', available: false },
        { price: '4.40', available: false },
        { price: '4.30', available: false },
      ],
    },
    {
      id: 9810968674577,
      title: 'Murder on the Orient Express',
      handle: 'murder-on-the-orient-express-book-agatha-christie-9780007527502',
      images: [],
      variants: [
        { price: '0.00', available: false },
        { price: '3.70', available: false },
        { price: '7.10', available: false },
      ],
    },
  ],
};

describe('authorFromHandle', () => {
  it('reads the contributor out of a book handle', () => {
    expect(authorFromHandle('murder-of-roger-ackroyd-book-agatha-christie-9780007527526')).toBe(
      'Agatha Christie',
    );
  });

  it('handles the other media formats the storefront sells', () => {
    expect(authorFromHandle('greatest-hits-cd-the-beatles-9780007527526')).toBe('The Beatles');
    expect(authorFromHandle('some-film-dvd-ridley-scott-9780007527526')).toBe('Ridley Scott');
  });

  it('uppercases initials rather than title-casing them', () => {
    expect(authorFromHandle('a-title-book-j-k-rowling-9780007527526')).toBe('J K Rowling');
  });

  it('accepts an Open Library id where there is no ISBN', () => {
    expect(authorFromHandle('a-title-book-agatha-christie-ol12345m')).toBe('Agatha Christie');
  });

  it('returns null rather than guessing when the handle does not carry an author', () => {
    expect(authorFromHandle('some-random-handle')).toBeNull();
    expect(authorFromHandle('')).toBeNull();
  });
});

describe('lowestVariantPrice', () => {
  it('takes the cheapest copy that is actually in stock', () => {
    expect(lowestVariantPrice(FEED.products[0].variants)).toBe(7.5);
  });

  it('falls back to the cheapest of any when nothing is available', () => {
    expect(lowestVariantPrice(FEED.products[1].variants)).toBe(4.3);
  });

  it('ignores a zero-priced variant, which means unpriced rather than free', () => {
    expect(lowestVariantPrice(FEED.products[2].variants)).toBe(3.7);
  });

  it('returns 0 for a title with no variants at all', () => {
    expect(lowestVariantPrice([])).toBe(0);
    expect(lowestVariantPrice(undefined)).toBe(0);
  });
});

describe('collectionFeedUrl', () => {
  it('points at the locale-prefixed collection feed', () => {
    expect(collectionFeedUrl('author-books-by-agatha-christie', 40, 2)).toBe(
      'https://www.worldofbooks.com/en-gb/collections/author-books-by-agatha-christie/products.json?limit=40&page=2',
    );
  });
});

describe('scrapeCollectionInBrowser', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  /** jsdom ships no fetch, so there is nothing to spy on — it has to be provided outright. */
  function mockFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
    const mock = jest.fn().mockResolvedValue({ ok: true, status: 200, ...response } as Response);
    global.fetch = mock as unknown as typeof fetch;
    return mock;
  }

  it('maps the feed into rows the product grid can render', async () => {
    mockFetch({ json: () => Promise.resolve(FEED) });

    const result = await scrapeCollectionInBrowser('author-books-by-agatha-christie');

    expect(result.products).toHaveLength(3);
    expect(result.products[0]).toMatchObject({
      source_id: '9810968609041',
      title: 'The Murder of Roger Ackroyd',
      author: 'Agatha Christie',
      price: 7.5,
      currency: 'GBP',
      source_url:
        'https://www.worldofbooks.com/en-gb/products/murder-of-roger-ackroyd-book-agatha-christie-9780007527526',
    });
  });

  it('marks rows as fetched here, so the page can say where they came from', async () => {
    mockFetch({ json: () => Promise.resolve(FEED) });

    const result = await scrapeCollectionInBrowser('author-books-by-agatha-christie');

    expect(result.products.every((product) => product.scraped_in_browser)).toBe(true);
  });

  it('sends no credentials, which would make the request need a preflight', async () => {
    const fetchSpy = mockFetch({ json: () => Promise.resolve(FEED) });

    await scrapeCollectionInBrowser('author-books-by-agatha-christie');

    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ credentials: 'omit' });
  });

  it('rejects on a non-200 so the caller falls back to the server', async () => {
    mockFetch({ ok: false, status: 403 });

    await expect(scrapeCollectionInBrowser('author-books-by-agatha-christie')).rejects.toThrow(
      '403',
    );
  });

  it('drops entries too incomplete to show, keeping the rest of the page', async () => {
    mockFetch({
      json: () =>
        Promise.resolve({
          products: [{ id: 1, handle: 'x' }, FEED.products[0]],
        }),
    });

    const result = await scrapeCollectionInBrowser('author-books-by-agatha-christie');

    expect(result.products).toHaveLength(1);
    expect(result.products[0].title).toBe('The Murder of Roger Ackroyd');
  });
});
