import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Product } from '@/lib/types';

const DEBOUNCE_DELAY = 300;
const MAX_SUGGESTIONS = 5;

export const useSearch = () => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  /**
   * The query a suggestion was chosen for. Comparing it against the current query hides the
   * list after a selection and re-opens it on the next keystroke, without needing an effect
   * to reset a boolean.
   */
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Load all products for client-side search
  useEffect(() => {
    const loadProducts = async () => {
      try {
        // This would normally come from an API
        // For now, we'll use an empty array
        setAllProducts([]);
      } catch (error) {
        console.error('Failed to load products for search:', error);
      }
    };
    loadProducts();
  }, []);

  // Debounce search query
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.trim()) {
      setIsSearching(true);
      debounceRef.current = setTimeout(() => {
        setDebouncedQuery(query);
        setIsSearching(false);
      }, DEBOUNCE_DELAY);
    } else {
      setDebouncedQuery('');
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  /**
   * Suggestions are *derived* from the debounced query and the loaded products, so they are
   * computed during render rather than pushed into state from an effect. The previous version
   * kept them in state and set them synchronously inside an effect, which costs an extra
   * render pass on every keystroke and leaves a frame where the list disagrees with the query.
   */
  const suggestions = useMemo(() => {
    if (dismissedFor !== null && dismissedFor === query) return [];
    const q = debouncedQuery.trim().toLowerCase();
    if (!q || allProducts.length === 0) return [];

    return allProducts
      .filter(
        (product) =>
          product.title.toLowerCase().includes(q) ||
          (product.detail?.description || '').toLowerCase().includes(q),
      )
      .slice(0, MAX_SUGGESTIONS);
  }, [debouncedQuery, allProducts, dismissedFor, query]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
    setIsSearching(false);
    setDismissedFor(null);
  }, []);

  const selectSuggestion = useCallback((product: Product) => {
    setQuery(product.title);
    setIsSearching(false);
    setDismissedFor(product.title);
  }, []);

  return {
    query,
    setQuery,
    debouncedQuery,
    suggestions,
    isSearching,
    isLoading: isSearching,
    error: null,
    clearSearch,
    selectSuggestion,
    results: suggestions,
    total: suggestions.length,
  };
};
