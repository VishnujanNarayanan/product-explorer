import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export abstract class BaseScraper {
  protected readonly logger = new Logger(this.constructor.name);

  // World of Books is a Shopify storefront. All content lives under a locale prefix;
  // requesting without it redirects and can serve a different template.
  protected readonly BASE_URL = 'https://www.worldofbooks.com';
  protected readonly LOCALE = '/en-gb';

  // Ethical scraping defaults
  protected readonly DEFAULT_DELAY_MS = parseInt(process.env.SCRAPE_DELAY_MS || '3000');
  protected readonly USER_AGENT =
    process.env.SCRAPE_USER_AGENT ||
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  protected readonly MAX_RETRIES = parseInt(process.env.SCRAPE_RETRY_COUNT || '3');

  /** Locale-qualified site root, e.g. https://www.worldofbooks.com/en-gb */
  protected get siteRoot(): string {
    return `${this.BASE_URL}${this.LOCALE}`;
  }

  protected collectionUrl(slug: string): string {
    return `${this.siteRoot}/collections/${slug}`;
  }

  /**
   * Shopify exposes a public JSON feed per collection. robots.txt permits this path
   * (only *sort_by* / *filter* collection variants are disallowed, which we never request).
   */
  protected collectionProductsJsonUrl(slug: string, page: number, limit = 250): string {
    return `${this.collectionUrl(slug)}/products.json?limit=${limit}&page=${page}`;
  }

  protected productUrl(handle: string): string {
    return `${this.siteRoot}/products/${handle}`;
  }

  protected recommendationsUrl(productId: string | number, limit = 6): string {
    return `${this.siteRoot}/recommendations/products.json?product_id=${productId}&limit=${limit}`;
  }

  protected async delay(ms: number = this.DEFAULT_DELAY_MS): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Resolve a possibly-relative href against the site origin. */
  protected absoluteUrl(href: string): string {
    if (!href) return '';
    try {
      return new URL(href, this.BASE_URL).toString();
    } catch {
      return '';
    }
  }

  protected extractSlugFromUrl(url: string): string {
    const cleanUrl = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
    const segments = cleanUrl.split('/').filter((s) => s.trim().length > 0);
    return segments.length > 0 ? segments[segments.length - 1] : 'home';
  }

  protected normalizePrice(priceText: string): { amount: number; currency: string } {
    const match = String(priceText).match(/([£$€])?\s*([\d,.]+)/);
    if (match) {
      const currency = this.currencySymbolToCode(match[1]);
      const amount = parseFloat(match[2].replace(/,/g, ''));
      return { amount: isNaN(amount) ? 0 : amount, currency };
    }
    return { amount: 0, currency: 'GBP' };
  }

  private currencySymbolToCode(symbol?: string): string {
    switch (symbol) {
      case '$':
        return 'USD';
      case '€':
        return 'EUR';
      default:
        return 'GBP';
    }
  }

  /**
   * products.json has no author field (`vendor` is always "WoB"), but the Shopify handle
   * encodes it: "<title>-<format>-<author>-<isbn|openlibrary-id>".
   * Verified against a 250-product sample: 250/250 parse.
   */
  protected parseAuthorFromHandle(handle: string): string | null {
    if (!handle) return null;
    const match = handle.match(
      /^.*?-(?:book|books|cd|cds|dvd|dvds|vinyl|blu-ray|audio)-(.+)-(?:\d{9,13}|ol\d+[a-z]?)$/i,
    );
    if (!match) return null;
    return this.slugToTitleCase(match[1]);
  }

  protected slugToTitleCase(slug: string): string {
    return slug
      .split('-')
      .filter(Boolean)
      .map((w) => (w.length <= 2 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
      .join(' ');
  }

  /** Strip HTML tags from Shopify's body_html into plain text. */
  protected stripHtml(html: string): string {
    if (!html) return '';
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  abstract scrape(url: string, data?: any): Promise<any>;
}
