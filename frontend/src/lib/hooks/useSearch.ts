import { useState, useCallback, useEffect, useRef } from 'react';
import { Product } from '@/lib/types';
import { debounce } from '@/lib/utils';

const DEBOUNCE_DELAY = 300;

export const useSearch = () => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);

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
      setSuggestions([]);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  // Client-side search
  useEffect(() => {
    if (debouncedQuery.trim() && allProducts.length > 0) {
      const searchResults = allProducts.filter(product =>
        product.title.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
        (product.detail?.description || '').toLowerCase().includes(debouncedQuery.toLowerCase())
      ).slice(0, 5); // Limit to 5 suggestions
      
      setSuggestions(searchResults);
    } else {
      setSuggestions([]);
    }
  }, [debouncedQuery, allProducts]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
    setSuggestions([]);
    setIsSearching(false);
  }, []);

  const selectSuggestion = useCallback((product: Product) => {
    setQuery(product.title);
    setSuggestions([]);
    setIsSearching(false);
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