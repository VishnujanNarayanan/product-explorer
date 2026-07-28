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
    api.get<{
      message: string;
      products: any[];
      category?: Category;
      jobQueued: boolean;
    }>(`/categories/${slug}/products${navigationQuery(navigationSlug)}`),

  // Trigger category scrape (POST endpoint for manual trigger)
  scrapeCategory: (slug: string, navigationSlug?: string) =>
    api.post<{
      message: string;
      products: any[];
      category?: Category;
      jobQueued: boolean;
    }>(`/scrape/category/${slug}${navigationQuery(navigationSlug)}`),
};