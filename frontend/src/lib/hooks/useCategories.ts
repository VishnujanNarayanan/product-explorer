import useSWR from 'swr';
import { navigationAPI } from '@/lib/api/navigation';
import { Category } from '@/lib/types';

export const useCategories = (navigationSlug?: string) => {
  const key = navigationSlug 
    ? `/categories?navigation=${navigationSlug}`
    : '/categories';

  const { data, error, isLoading, mutate } = useSWR(
    key,
    () => navigationAPI.getCategories(navigationSlug),
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      fallbackData: [],
    }
  );

  const refreshCategory = async (slug: string) => {
    try {
      await navigationAPI.scrapeCategory(slug);
      mutate(); // Revalidate categories
    } catch (error) {
      console.error('Failed to refresh category:', error);
      throw error;
    }
  };

  return {
    categories: data || [],
    isLoading,
    error,
    refreshCategory,
    mutate,
  };
};