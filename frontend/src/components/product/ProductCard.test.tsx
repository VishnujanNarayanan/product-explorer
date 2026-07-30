import { render, screen } from '@testing-library/react';
import { ProductCard } from './ProductCard';
import { Product } from '@/lib/types';

jest.mock('@/lib/hooks/useToast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('@/lib/api/products', () => ({
  productsAPI: { scrapeProduct: jest.fn() },
}));

// next/image needs a loader and layout machinery that jsdom has no use for. Next-only props
// are dropped rather than forwarded, or React warns about unknown DOM attributes.
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({
    fill: _fill,
    priority: _priority,
    sizes: _sizes,
    quality: _quality,
    loader: _loader,
    placeholder: _placeholder,
    blurDataURL: _blurDataURL,
    ...props
  }: Record<string, unknown>) =>
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img {...(props as React.ImgHTMLAttributes<HTMLImageElement>)} />,
}));

/** Shaped like a real row: a Shopify id, a CDN image, price as a decimal string. */
function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 41,
    source_id: '9846944432401',
    title: 'A Court of Thorns and Roses',
    author: 'Sarah J Maas',
    price: 4.1,
    currency: 'GBP',
    image_url: 'https://cdn.shopify.com/s/files/1/0784/4072/6801/files/152668.jpg',
    source_url:
      'https://www.worldofbooks.com/en-gb/products/court-of-thorns-and-roses-book-sarah-j-maas',
    last_scraped_at: '2026-07-27T10:36:00.000Z',
    ...overrides,
  } as Product;
}

describe('ProductCard', () => {
  // The assignment lists title, author, price, image, link and source id as the required
  // fields on a product tile.
  it('renders the title, author and price', () => {
    render(<ProductCard product={makeProduct()} />);

    expect(screen.getByText('A Court of Thorns and Roses')).toBeInTheDocument();
    expect(screen.getByText(/Sarah J Maas/)).toBeInTheDocument();
    expect(screen.getByText(/4\.1/)).toBeInTheDocument();
  });

  it('links to the product detail page by source id', () => {
    render(<ProductCard product={makeProduct()} />);

    expect(screen.getByRole('link', { name: /A Court of Thorns and Roses/ })).toHaveAttribute(
      'href',
      '/products/9846944432401',
    );
  });

  /**
   * A card also has to be useful for a book we do not hold a detail row for — one scraped into
   * the grid by the visitor's browser a moment ago has nowhere to go until it is stored, and
   * opening it returns a 404.
   */
  it('offers a way through to the book on World of Books', () => {
    render(<ProductCard product={makeProduct()} />);

    const outbound = screen.getByRole('link', { name: /Buy on World of Books/i });
    expect(outbound).toHaveAttribute(
      'href',
      'https://www.worldofbooks.com/en-gb/products/court-of-thorns-and-roses-book-sarah-j-maas',
    );
    // Leaving the app should not replace it, and a new tab must not keep a handle on this one.
    expect(outbound).toHaveAttribute('target', '_blank');
    expect(outbound).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('omits the outbound link when the product has no source URL', () => {
    render(<ProductCard product={{ ...makeProduct(), source_url: '' }} />);

    expect(screen.queryByRole('link', { name: /Buy on World of Books/i })).not.toBeInTheDocument();
  });

  // Accessibility baseline: an image conveying content needs a meaningful alt.
  it('gives the cover image the product title as alt text', () => {
    render(<ProductCard product={makeProduct()} />);
    expect(screen.getByAltText('A Court of Thorns and Roses')).toBeInTheDocument();
  });

  it('falls back to a placeholder when there is no image', () => {
    render(<ProductCard product={makeProduct({ image_url: '' })} />);

    expect(screen.queryByAltText('A Court of Thorns and Roses')).not.toBeInTheDocument();
    expect(screen.getByText(/no image available/i)).toBeInTheDocument();
  });

  it('shows the category when asked', () => {
    const product = makeProduct({
      category: { id: 11, title: 'Fantasy', slug: 'fantasy-fiction-books' } as Product['category'],
    });

    render(<ProductCard product={product} showCategory />);
    expect(screen.getByText(/Fantasy/)).toBeInTheDocument();
  });

  it('omits the category when asked not to show it', () => {
    const product = makeProduct({
      category: { id: 11, title: 'Fantasy', slug: 'fantasy-fiction-books' } as Product['category'],
    });

    render(<ProductCard product={product} showCategory={false} />);
    expect(screen.queryByText(/in Fantasy/)).not.toBeInTheDocument();
  });

  /**
   * World of Books publishes no ratings, so `ratings_avg` is always null and no star row
   * should appear. A card that invented stars would be showing users fabricated data.
   */
  it('renders no rating when there is none, which is always', () => {
    const { container } = render(<ProductCard product={makeProduct()} />);
    expect(container.querySelector('.fill-yellow-400')).toBeNull();
  });

  it('gives the refresh control an accessible name', () => {
    render(<ProductCard product={makeProduct()} />);
    expect(screen.getByRole('button', { name: /refresh product data/i })).toBeInTheDocument();
  });

  // DVDs and CDs often have no parseable author; the tile must not render a stray "by".
  it('omits the author line when there is no author', () => {
    render(<ProductCard product={makeProduct({ author: null })} />);

    expect(screen.getByText('A Court of Thorns and Roses')).toBeInTheDocument();
    expect(screen.queryByText(/^by /)).not.toBeInTheDocument();
  });
});
