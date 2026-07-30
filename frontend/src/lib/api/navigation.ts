import { api } from './client';
import { Navigation, Category } from '../types';

/** `?navigation=<slug>`, or nothing when the caller does not know the heading. */
const navigationQuery = (navigationSlug?: string) =>
  navigationSlug ? `?navigation=${encodeURIComponent(navigationSlug)}` : '';

export const navigationAPI = {
  // Get all navigation items
  getNavigation: () => api.get<Navigation[]>('/navigation'),
  
  // Trigger navigation scrape
  scrapeNavigation: () => api.post<{
    success: boolean;
    message: string;
    data: Navigation[];
  }>('/scrape/navigation'),
  
  // Get all categories (optionally filtered by navigation)
  getCategories: (navigationSlug?: string) => 
    api.get<Category[]>(navigationSlug ? `/categories?navigation=${navigationSlug}` : '/categories'),
  
  // Get single category by slug. A slug is unique per navigation heading, not globally —
  // pass the heading the user came from so the right copy is returned.
  getCategory: (slug: string, navigationSlug?: string) =>
    api.get<Category>(`/categories/${slug}${navigationQuery(navigationSlug)}`),

  // Get category products (triggers scrape if needed) - same as productsAPI.getProductsByCategory
  getCategoryProducts: (slug: string, navigationSlug?: string) =>
    api.get<CategoryProductsResponse>(
      `/categories/${slug}/products${navigationQuery(navigationSlug)}`,
    ),

  // Trigger category scrape (POST endpoint for manual trigger). `refresh` asks the server to
  // fetch another page during the request instead of only queueing one — which matters when
  // the queue is not running.
  scrapeCategory: (slug: string, navigationSlug?: string, refresh = false) =>
    api.post<CategoryProductsResponse>(
      `/scrape/category/${slug}${navigationQuery(navigationSlug)}`,
      { refresh },
    ),

  /**
   * Hands the server products this browser read from the collection feed.
   *
   * World of Books answers the API's datacentre address with 429 while serving a visitor's own
   * browser normally, so the browser is the only thing here that can reach the storefront. The
   * server validates every row before storing it — see ImportedProductDto — because nothing
   * arriving this way can be taken on trust.
   */
  importScrapedProducts: (
    slug: string,
    products: ImportableProduct[],
    options: { navigationSlug?: string; page?: number } = {},
  ) =>
    api.post<{ message: string; added: number; updated: number; total: number }>(
      `/categories/${slug}/import${navigationQuery(options.navigationSlug)}`,
      { products, page: options.page ?? 1 },
    ),
};

export interface CategoryProductsResponse {
  message: string;
  products: any[];
  category?: Category;
  jobQueued: boolean;
  /** Whether the request itself fetched from World of Books. */
  scrapedNow?: boolean;
  addedCount?: number;
  total?: number;
  /** Whether the collection has pages left — what "load more" depends on. */
  sourceHasMore?: boolean;
}

/** The fields the import endpoint accepts; anything else is rejected. */
export interface ImportableProduct {
  source_id: string;
  title: string;
  author: string | null;
  price: number;
  currency: string;
  image_url: string;
  source_url: string;
}