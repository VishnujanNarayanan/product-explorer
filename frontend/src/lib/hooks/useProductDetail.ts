import useSWR from 'swr';
import { productsAPI } from '@/lib/api/products';
import { Product } from '@/lib/types';

export const useProductDetail = (sourceId: string) => {
  const { data, error, isLoading, mutate } = useSWR(
    sourceId ? `/products/${sourceId}` : null,
    () => productsAPI.getProduct(sourceId),
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      errorRetryCount: 2,
    }
  );

  const refreshProduct = async (force = false) => {
    try {
      const result = await productsAPI.scrapeProduct(sourceId, force);
      
      // Update cache with new data
      mutate(result.data, {
        revalidate: false,
        optimisticData: result.data,
      });
      
      return result;
    } catch (error) {
      console.error('Failed to refresh product:', error);
      throw error;
    }
  };

  const getRecommendations = async (limit = 6) => {
    try {
      return await productsAPI.getRecommendations(sourceId, limit);
    } catch (error) {
      console.error('Failed to get recommendations:', error);
      return [];
    }
  };

  return {
    product: data,
    isLoading,
    error,
    refreshProduct,
    getRecommendations,
    mutate,
  };
};