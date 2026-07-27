import {
  cn,
  debounce,
  formatPrice,
  generateSlug,
  getRatingStars,
  isValidUrl,
  truncateText,
} from './index';

describe('formatPrice', () => {
  it('formats sterling with two decimals', () => {
    expect(formatPrice(3.5)).toBe('£3.50');
    expect(formatPrice(12.99)).toBe('£12.99');
  });

  it('honours a different currency', () => {
    expect(formatPrice(10, 'USD')).toBe('US$10.00');
  });

  // Products scraped without a price must not render as "£0.00", which would be a lie.
  it('reports a missing price rather than showing zero', () => {
    expect(formatPrice(null)).toBe('Price not available');
    expect(formatPrice(undefined as unknown as number)).toBe('Price not available');
  });

  // Only null/undefined mean "unknown". A genuine zero is a number and formats as one — note
  // that the listing scraper also yields 0 when no variant carries a parseable price, so a
  // £0.00 tile means "price could not be read", not "free".
  it('formats a genuine zero as a price', () => {
    expect(formatPrice(0)).toBe('£0.00');
  });
});

describe('getRatingStars', () => {
  /**
   * World of Books publishes no ratings, so null is the case that actually occurs — and it
   * has to yield five empty stars, never a partially filled row.
   */
  it('returns five empty stars for no rating', () => {
    expect(getRatingStars(null)).toEqual({ full: 0, half: 0, empty: 5 });
    expect(getRatingStars(0)).toEqual({ full: 0, half: 0, empty: 5 });
  });

  it.each([
    [5, { full: 5, half: 0, empty: 0 }],
    [4, { full: 4, half: 0, empty: 1 }],
    [4.5, { full: 4, half: 1, empty: 0 }],
    [3.3, { full: 3, half: 1, empty: 1 }],
    [3.1, { full: 3, half: 0, empty: 2 }],
    [3.8, { full: 3, half: 0, empty: 2 }],
  ])('splits %s into stars', (rating, expected) => {
    expect(getRatingStars(rating)).toEqual(expected);
  });

  it('always accounts for exactly five stars', () => {
    for (const r of [1, 2.5, 3.3, 4.9, 5]) {
      const { full, half, empty } = getRatingStars(r);
      expect(full + half + empty).toBe(5);
    }
  });
});

describe('truncateText', () => {
  it('leaves short text alone', () => {
    expect(truncateText('short', 20)).toBe('short');
  });

  it('truncates and appends an ellipsis', () => {
    expect(truncateText('the quick brown fox', 9)).toBe('the quick...');
  });

  it('trims before appending, so no space precedes the ellipsis', () => {
    expect(truncateText('the quick brown fox', 10)).toBe('the quick...');
  });
});

describe('generateSlug', () => {
  it('lowercases and hyphenates', () => {
    expect(generateSlug('Fantasy Fiction Books')).toBe('fantasy-fiction-books');
  });

  it('drops punctuation', () => {
    expect(generateSlug("Children's Books!")).toBe('childrens-books');
  });

  it('collapses repeated separators', () => {
    expect(generateSlug('Crime  &  Mystery')).toBe('crime-mystery');
  });
});

describe('isValidUrl', () => {
  it('accepts a real product URL', () => {
    expect(
      isValidUrl('https://www.worldofbooks.com/en-gb/products/the-hobbit-book'),
    ).toBe(true);
  });

  it('rejects junk', () => {
    expect(isValidUrl('not a url')).toBe(false);
    expect(isValidUrl('')).toBe(false);
  });
});

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values', () => {
    expect(cn('a', false && 'b', undefined, 'c')).toBe('a c');
  });

  // tailwind-merge is the reason this helper exists rather than a plain join.
  it('lets a later Tailwind class win over an earlier conflicting one', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
});

describe('debounce', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('calls through only once, after the delay', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced('a');
    debounced('b');
    debounced('c');
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
  });
});
