import { useState, useCallback } from 'react';
import { ProductFilters } from '@/lib/types';

const DEFAULT_FILTERS: ProductFilters = {
  minPrice: undefined,
  maxPrice: undefined,
  minRating: 0,
  author: '',
  sortBy: undefined,
};

export const useFilters = (initialFilters?: ProductFilters) => {
  const [filters, setFilters] = useState<ProductFilters>(
    initialFilters || DEFAULT_FILTERS
  );
  const [isFiltering, setIsFiltering] = useState(false);

  const updateFilter = useCallback(<K extends keyof ProductFilters>(
    key: K,
    value: ProductFilters[K]
  ) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
    setIsFiltering(true);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setIsFiltering(false);
  }, []);

  const applyFilters = useCallback((newFilters: ProductFilters) => {
    setFilters(newFilters);
    setIsFiltering(true);
  }, []);

  const hasActiveFilters = useCallback(() => {
    return Object.entries(filters).some(([key, value]) => {
      if (key === 'minRating') return value > 0;
      if (key === 'sortBy') return value !== undefined;
      return value !== undefined && value !== '';
    });
  }, [filters]);

  return {
    filters,
    isFiltering,
    updateFilter,
    resetFilters,
    applyFilters,
    hasActiveFilters: hasActiveFilters(),
  };
};