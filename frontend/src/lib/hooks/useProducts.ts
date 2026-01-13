import { useState, useCallback } from 'react';
import { productsAPI } from '@/lib/api/products';
import { Product, ProductFilters } from '@/lib/types';
import { useToast } from './useToast'; // Need to add this import

export const useProducts = (categorySlug?: string, initialFilters?: ProductFilters) => {
  const [filters, setFilters] = useState<ProductFilters>(initialFilters || {});
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast(); // Add toast hook

  const loadProducts = useCallback(async (): Promise<{ jobQueued: boolean }> => {
    setIsLoading(true);
    setError(null);
    try {
      let loadedProducts: Product[] = [];
      let jobQueued = false;
      
      if (categorySlug) {
        // Use the category products endpoint
        const response = await productsAPI.getProductsByCategory(categorySlug);
        loadedProducts = response.products || [];
        jobQueued = response.jobQueued || false;
      } else {
        // Fallback to all products
        const response = await productsAPI.getAllProducts();
        loadedProducts = Array.isArray(response) ? response : [];
      }
      
      // Apply client-side filters
      let filteredProducts = loadedProducts;
      
      if (filters.minPrice !== undefined) {
        filteredProducts = filteredProducts.filter(p => p.price && p.price >= filters.minPrice!);
      }
      
      if (filters.maxPrice !== undefined) {
        filteredProducts = filteredProducts.filter(p => p.price && p.price <= filters.maxPrice!);
      }
      
      if (filters.minRating !== undefined) {
        filteredProducts = filteredProducts.filter(p => 
          p.detail?.ratings_avg && p.detail.ratings_avg >= filters.minRating!
        );
      }
      
      // Apply sorting
      if (filters.sortBy) {
        filteredProducts.sort((a, b) => {
          switch (filters.sortBy) {
            case 'price_asc':
              return (a.price || 0) - (b.price || 0);
            case 'price_desc':
              return (b.price || 0) - (a.price || 0);
            case 'rating':
              return (b.detail?.ratings_avg || 0) - (a.detail?.ratings_avg || 0);
            case 'newest':
              return new Date(b.last_scraped_at).getTime() - new Date(a.last_scraped_at).getTime();
            case 'title':
              return a.title.localeCompare(b.title);
            default:
              return 0;
          }
        });
      }
      
      setProducts(filteredProducts);
      return { jobQueued };
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load products'));
      return { jobQueued: false };
    } finally {
      setIsLoading(false);
    }
  }, [categorySlug, filters]);

  const search = useCallback((query: string, newFilters?: ProductFilters) => {
    if (newFilters) setFilters(newFilters);
    // Client-side search can be implemented here
    loadProducts();
  }, [loadProducts]);

  const refreshProduct = useCallback(async (sourceId: string) => {
    try {
      const result = await productsAPI.scrapeProduct(sourceId, true);
      // Update product in local state
      setProducts(prev => prev.map(p => 
        p.source_id === sourceId ? { ...p, ...result.data } : p
      ));
      
      toast({
        title: "Product Refreshed",
        description: "Product details have been updated.",
      });
      
      return result;
    } catch (error) {
      console.error('Failed to refresh product:', error);
      throw error;
    }
  }, [toast]); // Add toast dependency

  const refreshCategory = useCallback(async (): Promise<{ jobQueued: boolean }> => {
    if (!categorySlug) return { jobQueued: false };
    
    try {
      setIsLoading(true);
      
      // This will trigger scraping
      const response = await productsAPI.getProductsByCategory(categorySlug);
      setProducts(response.products || []);
      
      return { jobQueued: response.jobQueued || false };
    } catch (error) {
      setError(error instanceof Error ? error : new Error('Failed to refresh category'));
      return { jobQueued: false };
    } finally {
      setIsLoading(false);
    }
  }, [categorySlug]);

  return {
    products,
    isLoading,
    error,
    filters,
    setFilters,
    loadProducts,
    search,
    refreshProduct,
    refreshCategory, // Add this new function
  };
};