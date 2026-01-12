import { api } from './client';
import { Navigation, Category } from '../types';

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
  
  // Get single category by slug
  getCategory: (slug: string) => 
    api.get<Category>(`/categories/${slug}`),
  
  // Get category products (triggers scrape if needed)
  getCategoryProducts: (slug: string) => 
    api.get<{
      message: string;
      products: any[];
      category?: Category;
      jobQueued: boolean;
    }>(`/categories/${slug}/products`),
  
  // Trigger category scrape
  scrapeCategory: (slug: string) => 
    api.post(`/scrape/category/${slug}`),
};