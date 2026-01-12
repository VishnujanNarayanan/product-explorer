// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  jobId?: number;
  jobQueued?: boolean;
  hasDetails?: boolean;
}

// Navigation Types
export interface Navigation {
  id: number;
  title: string;
  slug: string;
  last_scraped_at: string; // ISO string from backend
  categories?: Category[];
}

export interface Category {
  id: number;
  title: string;
  slug: string;
  product_count: number;
  last_scraped_at: string; // ISO string from backend
  navigation_id?: number;
  parent_id?: number;
  navigation?: Navigation;
  parent?: Category;
  children?: Category[];
  products?: Product[];
}

export interface Product {
  id: number;
  source_id: string;
  title: string;
  price: number | null;
  currency: string;
  image_url: string;
  source_url: string;
  last_scraped_at: string; // ISO string from backend
  category_id?: number;
  category?: Category;
  detail?: ProductDetail;
  reviews?: Review[];
}

export interface ProductDetail {
  product_id: number;
  description: string;
  specs: Record<string, any>;
  ratings_avg: number | null;
  reviews_count: number;
  product?: Product;
}

export interface Review {
  id: number;
  author: string;
  rating: number;
  text: string;
  created_at: string; // ISO string
  product_id: number;
}

export interface ScrapeJob {
  id: number;
  target_url: string;
  target_type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  started_at: string | null;
  finished_at: string | null;
  error_log: string | null;
}

export interface ViewHistory {
  id: number;
  user_id: string | null;
  session_id: string;
  path_json: any;
  created_at: string;
}

// Filter Types
export interface ProductFilters {
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  author?: string;
  inStock?: boolean;
  sortBy?: 'price_asc' | 'price_desc' | 'rating' | 'newest' | 'title';
}

export interface SearchParams {
  query: string;
  category?: string;
  filters?: ProductFilters;
  page?: number;
  limit?: number;
}

// API Response Types for specific endpoints
export interface CategoryProductsResponse {
  message: string;
  products: Product[];
  category?: Category;
  jobQueued: boolean;
}

export interface ScrapeProductResponse {
  success: boolean;
  message: string;
  data: Product;
  hasDetails: boolean;
  jobQueued: boolean;
  jobId?: number;
}

// UI Types
export interface BreadcrumbItem {
  label: string;
  href: string;
}

export interface Toast {
  id: string;
  title: string;
  description?: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}