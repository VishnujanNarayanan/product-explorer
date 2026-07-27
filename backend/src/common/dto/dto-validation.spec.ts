import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto';
import { NumericIdParamDto, SlugParamDto, SourceIdParamDto } from './params.dto';
import { GetProductsQueryDto } from '../../modules/products/dto';
import {
  GetCategoriesQueryDto,
  GetProductQueryDto,
  LegacyScrapeParamsDto,
  ScrapeProductBodyDto,
} from '../../modules/core/dto';

/** Mirrors the global ValidationPipe: transform first, then validate. */
function check<T extends object>(cls: new () => T, payload: Record<string, unknown>) {
  const instance = plainToInstance(cls, payload, { enableImplicitConversion: false });
  const errors = validateSync(instance as object, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
  return { instance, errors, messages, ok: errors.length === 0 };
}

describe('PaginationQueryDto', () => {
  it('coerces numeric strings, because query values always arrive as strings', () => {
    const { ok, instance } = check(PaginationQueryDto, { page: '3', limit: '50' });
    expect(ok).toBe(true);
    expect(instance.page).toBe(3);
    expect(instance.limit).toBe(50);
  });

  it('applies defaults when omitted', () => {
    const { ok, instance } = check(PaginationQueryDto, {});
    expect(ok).toBe(true);
    expect(instance.page).toBe(1);
    expect(instance.limit).toBe(24);
  });

  it('rejects a page below 1', () => {
    const { ok, messages } = check(PaginationQueryDto, { page: '0' });
    expect(ok).toBe(false);
    expect(messages).toContain('page must be 1 or greater');
  });

  it('rejects a non-numeric page', () => {
    const { ok, messages } = check(PaginationQueryDto, { page: 'abc' });
    expect(ok).toBe(false);
    expect(messages).toContain('page must be an integer');
  });

  // The cap is what stops one request pulling the whole catalogue into memory.
  it('rejects a limit above 100', () => {
    const { ok, messages } = check(PaginationQueryDto, { limit: '9999' });
    expect(ok).toBe(false);
    expect(messages).toContain('limit may not exceed 100');
  });

  it('accepts the boundary values', () => {
    expect(check(PaginationQueryDto, { limit: '100' }).ok).toBe(true);
    expect(check(PaginationQueryDto, { limit: '1', page: '1' }).ok).toBe(true);
  });

  it('rejects a fractional page', () => {
    expect(check(PaginationQueryDto, { page: '1.5' }).ok).toBe(false);
  });
});

describe('SlugParamDto', () => {
  // Every slug below is real, taken from the 113 scraped categories.
  it.each([
    'fantasy-fiction-books',
    'author-books-by-sarah-j-maas',
    'summer-reads-under-4',
    'dvds-and-blu-ray',
    'all',
  ])('accepts the real slug %s', (slug) => {
    expect(check(SlugParamDto, { slug }).ok).toBe(true);
  });

  it.each([
    ['Uppercase-Slug', 'capitals'],
    ['bad_slug', 'underscore'],
    ['trailing-', 'trailing hyphen'],
    ['-leading', 'leading hyphen'],
    ['double--hyphen', 'doubled hyphen'],
    ['has space', 'whitespace'],
    ['../../etc/passwd', 'path traversal'],
    ['', 'empty'],
  ])('rejects %s (%s)', (slug) => {
    expect(check(SlugParamDto, { slug }).ok).toBe(false);
  });
});

describe('SourceIdParamDto', () => {
  it('accepts a numeric Shopify id', () => {
    expect(check(SourceIdParamDto, { sourceId: '9846944432401' }).ok).toBe(true);
  });

  // The detail scraper falls back to the URL handle when a page exposes no Shopify id.
  it('accepts a handle-shaped fallback id', () => {
    expect(
      check(SourceIdParamDto, { sourceId: 'housemaid-book-freida-mcfadden-9781408728512' }).ok,
    ).toBe(true);
  });

  it.each(['bad id', '../escape', 'semi;colon', ''])('rejects %s', (sourceId) => {
    expect(check(SourceIdParamDto, { sourceId }).ok).toBe(false);
  });
});

describe('NumericIdParamDto', () => {
  it('coerces a numeric path segment', () => {
    const { ok, instance } = check(NumericIdParamDto, { id: '7' });
    expect(ok).toBe(true);
    expect(instance.id).toBe(7);
  });

  it.each(['notanumber', '0', '-3'])('rejects %s', (id) => {
    expect(check(NumericIdParamDto, { id }).ok).toBe(false);
  });
});

describe('boolean query coercion', () => {
  // Implicit conversion would treat the string "false" as true, which is why the DTO
  // transforms explicitly.
  it.each([
    ['true', true],
    ['1', true],
    ['false', false],
    ['0', false],
  ])('maps %s to %s', (input, expected) => {
    const { ok, instance } = check(GetProductQueryDto, { refresh: input });
    expect(ok).toBe(true);
    expect(instance.refresh).toBe(expected);
  });

  it('treats an omitted flag as undefined rather than false', () => {
    expect(check(GetProductQueryDto, {}).instance.refresh).toBeUndefined();
  });

  it('rejects a value that is neither boolean nor boolean-like', () => {
    const { ok, messages } = check(GetProductQueryDto, { refresh: 'maybe' });
    expect(ok).toBe(false);
    expect(messages).toContain('refresh must be true or false');
  });

  it('applies the same rules to the scrape request body', () => {
    expect(check(ScrapeProductBodyDto, { refresh: true }).ok).toBe(true);
    expect(check(ScrapeProductBodyDto, { refresh: 'nope' }).ok).toBe(false);
  });
});

describe('unknown properties', () => {
  // forbidNonWhitelisted is what turns a typo'd parameter into an error instead of silence.
  it('rejects a property the DTO does not declare', () => {
    const { ok, messages } = check(GetProductsQueryDto, { bogusParam: '1' });
    expect(ok).toBe(false);
    expect(messages.join(' ')).toContain('should not exist');
  });

  it('rejects an unknown property on the request body', () => {
    expect(check(ScrapeProductBodyDto, { evil: 1 }).ok).toBe(false);
  });
});

describe('GetCategoriesQueryDto', () => {
  it('accepts a navigation slug and allows omission', () => {
    expect(check(GetCategoriesQueryDto, { navigation: 'fiction-books' }).ok).toBe(true);
    expect(check(GetCategoriesQueryDto, {}).ok).toBe(true);
  });

  it('rejects a malformed navigation slug', () => {
    expect(check(GetCategoriesQueryDto, { navigation: 'NOT../A/SLUG' }).ok).toBe(false);
  });
});

describe('GetProductsQueryDto', () => {
  it('combines paging with a category filter', () => {
    const { ok, instance } = check(GetProductsQueryDto, {
      category: 'fantasy-fiction-books',
      page: '2',
      limit: '10',
    });
    expect(ok).toBe(true);
    expect(instance.category).toBe('fantasy-fiction-books');
    expect(instance.page).toBe(2);
  });

  it('rejects a malformed category slug', () => {
    expect(check(GetProductsQueryDto, { category: 'Bad_Slug!' }).ok).toBe(false);
  });
});

describe('LegacyScrapeParamsDto', () => {
  it.each(['navigation', 'category', 'product'])('accepts the %s type', (type) => {
    expect(check(LegacyScrapeParamsDto, { type, target: 'anything' }).ok).toBe(true);
  });

  it('rejects an unknown type', () => {
    const { ok, messages } = check(LegacyScrapeParamsDto, { type: 'bogus', target: 'x' });
    expect(ok).toBe(false);
    expect(messages).toContain('type must be one of: navigation, category, product');
  });
});
