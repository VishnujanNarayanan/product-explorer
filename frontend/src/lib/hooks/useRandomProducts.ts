import { useCallback, useEffect, useState } from 'react';
import { productsAPI } from '@/lib/api/products';
import { Product } from '@/lib/types';

/**
 * A shelf of random stored books for the home page.
 *
 * Deliberately not SWR-cached: the point of the shelf is that it is different every time
 * you arrive, and `reshuffle` asks for another draw. Nothing here scrapes.
 */
export const useRandomProducts = (limit = 12) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await productsAPI.getRandomProducts(limit);
      setProducts(response.products || []);
      setTotal(response.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load books'));
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    load();
  }, [load]);

  return { products, total, isLoading, error, reshuffle: load };
};
