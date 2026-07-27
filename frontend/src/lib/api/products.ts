// frontend/src/lib/api/products.ts

import { api } from './client';
import { Product, ProductFilters, ScrapeProductResponse } from '../types';

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CategoryProductsResponse extends PaginationMeta {
  message: string;
  products: Product[];
  category?: any;
  jobQueued: boolean;
}

export interface ProductsResponse extends PaginationMeta {
  products: Product[];
}

/** Build a `?page=&limit=` string, omitting either value when it is not supplied. */
function pageQuery(page?: number, limit?: number): string {
  const params = new URLSearchParams();
  if (page !== undefined) params.set('page', String(page));
  if (limit !== undefined) params.set('limit', String(limit));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const productsAPI = {
  // Get category products (triggers scrape if needed) - uses same endpoint as navigationAPI
  getProductsByCategory: (categorySlug: string, page?: number, limit?: number) =>
    api.get<CategoryProductsResponse>(
      `/categories/${categorySlug}/products${pageQuery(page, limit)}`,
    ),

  // Get all products. The endpoint is paged, so this returns an envelope, not a bare array.
  getAllProducts: (page?: number, limit?: number) =>
    api.get<ProductsResponse>(`/products${pageQuery(page, limit)}`),
  
  // Get single product by source_id
  getProduct: (sourceId: string, refresh?: boolean) => 
    api.get<Product>(`/products/${sourceId}${refresh ? '?refresh=true' : ''}`),
  
  // Trigger product detail scrape
  scrapeProduct: (sourceId: string, refresh?: boolean) => 
    api.post<ScrapeProductResponse>(`/scrape/product/${sourceId}`, { refresh }),
  
  // Client-side search (since backend doesn't have search endpoint yet)
  searchProducts: (query: string, filters?: ProductFilters) => {
    // This is client-side filtering for now
    return {
      products: [] as Product[],
      total: 0,
      page: 1,
      limit: 20,
      hasMore: false
    };
  },
  
  // Get product recommendations (client-side for now)
  getRecommendations: (sourceId: string, limit = 6) => {
    // Return empty array for now - can implement based on category
    return Promise.resolve([] as Product[]);
  },
};