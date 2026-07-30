import { navigationAPI } from './navigation';
import { api } from './client';
import { ScrapedProduct } from '../scrape/browser-scraper';

jest.mock('./client', () => ({
  api: { post: jest.fn().mockResolvedValue({ added: 0, updated: 0, total: 0, message: '' }) },
}));

/**
 * The import endpoint validates with `forbidNonWhitelisted`, so a single property it does not
 * declare rejects the whole batch — and that rejection happens in the validation pipe, before any
 * controller, so the server logs nothing at all.
 *
 * That is not hypothetical. Rows went out carrying `scraped_in_browser`, the flag the grid uses
 * to mark books this browser fetched; every import came back 400; and books kept appearing in the
 * grid and 404ing when opened, with nothing anywhere saying why. Hence a test on the shape of
 * what is actually sent, not only on what the server accepts.
 */
describe('importScrapedProducts payload', () => {
  const scraped: ScrapedProduct = {
    source_id: '9810968609041',
    title: 'The Murder of Roger Ackroyd',
    author: 'Agatha Christie',
    price: 7.5,
    currency: 'GBP',
    image_url: 'https://cdn.shopify.com/s/files/1/0784/4072/6801/files/0007527527.jpg',
    source_url:
      'https://www.worldofbooks.com/en-gb/products/murder-of-roger-ackroyd-book-agatha-christie-9780007527526',
    scraped_in_browser: true,
  };

  const ALLOWED = [
    'source_id',
    'title',
    'author',
    'price',
    'currency',
    'image_url',
    'source_url',
  ].sort();

  beforeEach(() => {
    (api.post as jest.Mock).mockClear();
  });

  function sentBody() {
    return (api.post as jest.Mock).mock.calls[0][1] as {
      products: Record<string, unknown>[];
      page: number;
    };
  }

  it('sends only the fields the API declares', async () => {
    await navigationAPI.importScrapedProducts('author-books-by-agatha-christie', [scraped]);

    expect(Object.keys(sentBody().products[0]).sort()).toEqual(ALLOWED);
  });

  it('drops the browser-only marker that would reject the whole batch', async () => {
    await navigationAPI.importScrapedProducts('author-books-by-agatha-christie', [scraped]);

    expect(sentBody().products[0]).not.toHaveProperty('scraped_in_browser');
  });

  it('drops anything else a caller happens to be carrying', async () => {
    const withExtras = { ...scraped, category: { id: 1 }, id: 99, last_scraped_at: 'now' };

    await navigationAPI.importScrapedProducts('author-books-by-agatha-christie', [
      withExtras as unknown as ScrapedProduct,
    ]);

    expect(Object.keys(sentBody().products[0]).sort()).toEqual(ALLOWED);
  });

  it('keeps the values intact while dropping the extra keys', async () => {
    await navigationAPI.importScrapedProducts('author-books-by-agatha-christie', [scraped]);

    expect(sentBody().products[0]).toMatchObject({
      source_id: '9810968609041',
      title: 'The Murder of Roger Ackroyd',
      author: 'Agatha Christie',
      price: 7.5,
      currency: 'GBP',
    });
  });

  it('passes the feed page through, so the checkpoint can advance', async () => {
    await navigationAPI.importScrapedProducts('a-slug', [scraped], { page: 3 });

    expect(sentBody().page).toBe(3);
  });

  it('defaults to page 1 when the caller does not say', async () => {
    await navigationAPI.importScrapedProducts('a-slug', [scraped]);

    expect(sentBody().page).toBe(1);
  });

  it('scopes the import to the navigation heading when there is one', async () => {
    await navigationAPI.importScrapedProducts('a-slug', [scraped], {
      navigationSlug: 'fiction-books',
    });

    expect((api.post as jest.Mock).mock.calls[0][0]).toBe(
      '/categories/a-slug/import?navigation=fiction-books',
    );
  });
});
