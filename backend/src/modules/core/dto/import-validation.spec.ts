import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ImportScrapedProductsDto } from './index';

/**
 * `POST /api/categories/:slug/import` is the one place in the app that stores something the
 * server did not fetch itself. It exists because World of Books answers the API's datacentre
 * address with 429 while serving a visitor's own browser normally, which makes the browser the
 * only thing here that can reach the storefront.
 *
 * That makes this DTO the security boundary rather than a formality, so these tests are about
 * what it refuses. A caller can still post a plausible book that does not exist — inherent in
 * accepting client data — but it cannot point the catalogue at another host, price a book at a
 * million pounds, or bury the database under one request.
 */

/** Mirrors the global ValidationPipe: transform first, then validate. */
function check(payload: Record<string, unknown>) {
  const instance = plainToInstance(ImportScrapedProductsDto, payload, {
    enableImplicitConversion: false,
  });
  const errors = validateSync(instance as object, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  const messages = errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...(error.children ?? []).flatMap((child) =>
      (child.children ?? []).flatMap((grandchild) =>
        Object.values(grandchild.constraints ?? {}),
      ),
    ),
  ]);

  return { instance, errors, messages, ok: errors.length === 0 };
}

const VALID = {
  source_id: '9810968609041',
  title: 'The Murder of Roger Ackroyd',
  author: 'Agatha Christie',
  price: 7.5,
  currency: 'GBP',
  image_url: 'https://cdn.shopify.com/s/files/1/0784/4072/6801/files/0007527527.jpg',
  source_url:
    'https://www.worldofbooks.com/en-gb/products/murder-of-roger-ackroyd-book-agatha-christie-9780007527526',
};

const withProduct = (overrides: Record<string, unknown>) => ({
  products: [{ ...VALID, ...overrides }],
  page: 1,
});

describe('ImportScrapedProductsDto', () => {
  it('accepts a row exactly as the browser scraper produces it', () => {
    expect(check(withProduct({})).ok).toBe(true);
  });

  it('accepts a book whose author could not be read from the handle', () => {
    expect(check(withProduct({ author: null })).ok).toBe(true);
  });

  describe('refuses anything pointing away from World of Books', () => {
    it('rejects a product URL on another host', () => {
      const { ok, messages } = check(
        withProduct({ source_url: 'https://evil.example.com/en-gb/products/x' }),
      );
      expect(ok).toBe(false);
      expect(messages.join('\n')).toContain('World of Books product URL');
    });

    it('rejects an image hosted anywhere but Shopify’s CDN', () => {
      const { ok, messages } = check(
        withProduct({ image_url: 'https://evil.example.com/tracker.gif' }),
      );
      expect(ok).toBe(false);
      expect(messages.join('\n')).toContain('Shopify CDN');
    });

    it('rejects a product URL that only starts with the right host', () => {
      const { ok } = check(
        withProduct({
          source_url: 'https://www.worldofbooks.com.evil.example.com/en-gb/products/x',
        }),
      );
      expect(ok).toBe(false);
    });

    it('rejects a javascript: URL', () => {
      const { ok } = check(withProduct({ source_url: 'javascript:alert(1)' }));
      expect(ok).toBe(false);
    });
  });

  describe('refuses values that could not have come from the feed', () => {
    it('rejects a source id that is not a Shopify numeric id', () => {
      const { ok, messages } = check(withProduct({ source_id: 'not-an-id' }));
      expect(ok).toBe(false);
      expect(messages.join('\n')).toContain('Shopify numeric id');
    });

    it('rejects an implausible price', () => {
      expect(check(withProduct({ price: 1000000 })).ok).toBe(false);
      expect(check(withProduct({ price: -5 })).ok).toBe(false);
    });

    it('rejects a currency the /en-gb storefront never quotes', () => {
      const { ok, messages } = check(withProduct({ currency: 'USD' }));
      expect(ok).toBe(false);
      expect(messages.join('\n')).toContain('GBP');
    });

    it('rejects a title long enough to be a payload rather than a title', () => {
      expect(check(withProduct({ title: 'x'.repeat(501) })).ok).toBe(false);
    });

    it('rejects a field the feed has no equivalent of', () => {
      const { ok } = check({ products: [{ ...VALID, is_admin: true }], page: 1 });
      expect(ok).toBe(false);
    });
  });

  describe('bounds the request itself', () => {
    it('rejects more rows than a feed page can hold', () => {
      const { ok } = check({ products: Array.from({ length: 251 }, () => ({ ...VALID })) });
      expect(ok).toBe(false);
    });

    it('accepts a full feed page', () => {
      const { ok } = check({ products: Array.from({ length: 250 }, () => ({ ...VALID })) });
      expect(ok).toBe(true);
    });

    it('rejects an empty import, which has nothing to store', () => {
      expect(check({ products: [] }).ok).toBe(false);
    });

    it('rejects a page number outside the range a collection has', () => {
      expect(check({ ...withProduct({}), page: 0 }).ok).toBe(false);
      expect(check({ ...withProduct({}), page: 101 }).ok).toBe(false);
    });
  });
});
