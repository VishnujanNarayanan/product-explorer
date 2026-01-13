// frontend/src/lib/api/products.ts

import { api } from './client';
import { Product, ProductFilters, ScrapeProductResponse } from '../types';

export interface CategoryProductsResponse {
  message: string;
  products: Product[];
  category?: any;
  jobQueued: boolean;
}

export const productsAPI = {
  // Get category products (triggers scrape if needed) - uses same endpoint as navigationAPI
  getProductsByCategory: (categorySlug: string) => 
    api.get<CategoryProductsResponse>(`/categories/${categorySlug}/products`),
  
  // Get all products (fallback to all categories)
  getAllProducts: () => 
    api.get<Product[]>('/products'),
  
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