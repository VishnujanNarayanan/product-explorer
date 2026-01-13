import useSWR from 'swr';
import { navigationAPI } from '@/lib/api/navigation';
import { Navigation } from '@/lib/types';

export const useNavigation = () => {
  const { data, error, isLoading, mutate } = useSWR(
    '/navigation',
    navigationAPI.getNavigation,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute
      fallbackData: [],
    }
  );

  const refreshNavigation = async () => {
    try {
      const result = await navigationAPI.scrapeNavigation();
      // Update the cache with new data from the response
      if (result.data && Array.isArray(result.data)) {
        mutate(result.data, false); // Update cache without revalidation
      } else {
        // If response doesn't have data, revalidate from the server
        mutate();
      }
      return result;
    } catch (error) {
      console.error('Failed to refresh navigation:', error);
      throw error;
    }
  };

  return {
    navigation: data || [],
    isLoading,
    error,
    refreshNavigation,
    mutate,
  };
};