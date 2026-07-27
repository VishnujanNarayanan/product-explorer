import { BaseScraper } from './base.scraper';

/**
 * BaseScraper's helpers are protected, and they encode the awkward facts about the target
 * site — the locale prefix, the handle format that hides the author, Shopify's JSON feed
 * paths. A thin subclass exposes them so those rules can be pinned down without a network
 * round trip.
 */
class TestScraper extends BaseScraper {
  async scrape(): Promise<unknown> {
    return null;
  }

  get root() {
    return this.siteRoot;
  }
  collection(slug: string) {
    return this.collectionUrl(slug);
  }
  collectionJson(slug: string, page: number, limit?: number) {
    return this.collectionProductsJsonUrl(slug, page, limit);
  }
  product(handle: string) {
    return this.productUrl(handle);
  }
  recommendations(id: string | number, limit?: number) {
    return this.recommendationsUrl(id, limit);
  }
  author(handle: string) {
    return this.parseAuthorFromHandle(handle);
  }
  slugFromUrl(url: string) {
    return this.extractSlugFromUrl(url);
  }
  price(text: string) {
    return this.normalizePrice(text);
  }
  html(input: string) {
    return this.stripHtml(input);
  }
  absolute(href: string) {
    return this.absoluteUrl(href);
  }
}

describe('BaseScraper', () => {
  let scraper: TestScraper;

  beforeEach(() => {
    scraper = new TestScraper();
  });

  describe('URL construction', () => {
    // The bare domain redirects and serves a reduced navigation menu, so every URL the
    // scrapers build has to carry the /en-gb prefix.
    it('includes the en-gb locale prefix in the site root', () => {
      expect(scraper.root).toBe('https://www.worldofbooks.com/en-gb');
    });

    it('builds locale-qualified collection URLs', () => {
      expect(scraper.collection('fantasy-fiction-books')).toBe(
        'https://www.worldofbooks.com/en-gb/collections/fantasy-fiction-books',
      );
    });

    it('builds the Shopify products.json feed URL with paging', () => {
      expect(scraper.collectionJson('crime-and-mystery-books', 2, 50)).toBe(
        'https://www.worldofbooks.com/en-gb/collections/crime-and-mystery-books/products.json?limit=50&page=2',
      );
    });

    it('defaults the feed page size to 250', () => {
      expect(scraper.collectionJson('rare-crime-books', 1)).toContain('limit=250');
    });

    // robots.txt disallows sort_by and filter collection variants; nothing may construct one.
    it('never emits a disallowed sort_by or filter parameter', () => {
      const url = scraper.collectionJson('classical-cds', 1, 40);
      expect(url).not.toContain('sort_by');
      expect(url).not.toContain('filter');
    });

    it('builds product and recommendation URLs', () => {
      expect(scraper.product('the-hobbit-book-j-r-r-tolkien-9780008376055')).toBe(
        'https://www.worldofbooks.com/en-gb/products/the-hobbit-book-j-r-r-tolkien-9780008376055',
      );
      expect(scraper.recommendations('9846944432401', 6)).toBe(
        'https://www.worldofbooks.com/en-gb/recommendations/products.json?product_id=9846944432401&limit=6',
      );
    });

    it('resolves relative hrefs against the origin and rejects unparseable ones', () => {
      expect(scraper.absolute('/en-gb/collections/x')).toBe(
        'https://www.worldofbooks.com/en-gb/collections/x',
      );
      expect(scraper.absolute('')).toBe('');
    });
  });

  describe('parseAuthorFromHandle', () => {
    // products.json has no author field — `vendor` is always "WoB" — but the Shopify handle
    // encodes it as "<title>-<format>-<author>-<isbn|openlibrary-id>".
    it.each([
      ['housemaid-book-freida-mcfadden-9781408728512', 'Freida Mcfadden'],
      ['court-of-thorns-and-roses-book-sarah-j-maas-9780008387884', 'Sarah J Maas'],
      ['thursday-murder-club-book-richard-osman-9780241988268', 'Richard Osman'],
    ])('extracts the author from %s', (handle, expected) => {
      expect(scraper.author(handle)).toBe(expected);
    });

    it('handles non-book media formats', () => {
      expect(scraper.author('some-film-dvd-a-director-9781408728512')).toBe('A Director');
    });

    it('uppercases short words so initials survive title casing', () => {
      expect(scraper.author('a-title-book-j-k-rowling-9780008376055')).toBe('J K Rowling');
    });

    it('accepts an OpenLibrary id in place of an ISBN', () => {
      expect(scraper.author('a-rare-title-book-some-author-ol12345a')).toBe('Some Author');
    });

    it('returns null when the handle does not carry an author', () => {
      expect(scraper.author('gift-card')).toBeNull();
      expect(scraper.author('')).toBeNull();
    });
  });

  describe('normalizePrice', () => {
    it('reads the currency symbol', () => {
      expect(scraper.price('£3.70')).toEqual({ amount: 3.7, currency: 'GBP' });
      expect(scraper.price('$12.99')).toEqual({ amount: 12.99, currency: 'USD' });
      expect(scraper.price('€8.50')).toEqual({ amount: 8.5, currency: 'EUR' });
    });

    it('strips thousands separators', () => {
      expect(scraper.price('£1,234.56')).toEqual({ amount: 1234.56, currency: 'GBP' });
    });

    it('falls back to zero GBP on unparseable input', () => {
      expect(scraper.price('Out of stock')).toEqual({ amount: 0, currency: 'GBP' });
    });
  });

  describe('stripHtml', () => {
    it('reduces Shopify body_html to plain text', () => {
      expect(scraper.html('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
    });

    it('decodes the entities Shopify emits', () => {
      expect(scraper.html('<p>Tom &amp; Jerry &quot;quoted&quot; &#39;s&nbsp;end</p>')).toBe(
        'Tom & Jerry "quoted" \'s end',
      );
    });

    it('drops script and style content rather than inlining it', () => {
      expect(scraper.html('<script>alert(1)</script><p>safe</p>')).toBe('safe');
      expect(scraper.html('<style>p{color:red}</style><p>safe</p>')).toBe('safe');
    });

    it('returns an empty string for empty input', () => {
      expect(scraper.html('')).toBe('');
    });
  });

  describe('extractSlugFromUrl', () => {
    it('takes the last path segment, ignoring the query string', () => {
      expect(
        scraper.slugFromUrl('https://www.worldofbooks.com/en-gb/products/the-hobbit?variant=1'),
      ).toBe('the-hobbit');
    });

    it('falls back to "home" for a bare origin', () => {
      expect(scraper.slugFromUrl('https://www.worldofbooks.com')).toBe('home');
    });
  });
});
