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
      mutate(result.data, false); // Update cache without revalidation
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