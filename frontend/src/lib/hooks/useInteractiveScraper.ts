// frontend/src/lib/hooks/useInteractiveScraper.ts (FULL CORRECTED)
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { webSocketClient, WebSocketResponse } from '@/lib/api/websocket';
import { Product } from '@/lib/types';
import { useToast } from './useToast';

export interface InteractiveScraperState {
  isConnected: boolean;
  sessionId: string | null;
  status: 'idle' | 'scraping' | 'ready' | 'error';
  products: Product[];
  totalScraped: number;
  currentChunk: number;
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  currentCategory: string | null;
}

export const useInteractiveScraper = () => {
  const { toast } = useToast();
  const [state, setState] = useState<InteractiveScraperState>({
    isConnected: false,
    sessionId: null,
    status: 'idle',
    products: [],
    totalScraped: 0,
    currentChunk: 0,
    isLoading: false,
    error: null,
    hasMore: false,
    currentCategory: null,
  });

  const productsCache = useRef<Map<string, Product[]>>(new Map());
  const currentCategoryRef = useRef<string | null>(null);
  const initialStateSet = useRef(false);

  // Memoize event handlers to prevent re-creation
  const eventHandlers = useMemo(() => ({
    handleSessionReady: (data: WebSocketResponse) => {
      setState(prev => ({
        ...prev,
        isConnected: true,
        sessionId: data.payload.sessionId || null,
        status: 'ready',
      }));
      
      toast({
        title: 'Interactive Mode Ready',
        description: 'Real-time scraper session initialized',
      });
    },

    handleDataChunk: (data: WebSocketResponse) => {
      if (data.payload.products && currentCategoryRef.current) {
        const category = currentCategoryRef.current;
        const currentCache = productsCache.current.get(category) || [];
        
        // Filter out duplicates
        const newProducts = data.payload.products.filter(
          newProduct => !currentCache.some(
            existing => existing.source_id === newProduct.source_id
          )
        );
        
        // Update cache
        const updatedCache = [...currentCache, ...newProducts];
        productsCache.current.set(category, updatedCache);
        
        setState(prev => ({
          ...prev,
          products: updatedCache,
          totalScraped: data.payload.totalScraped || updatedCache.length,
          currentChunk: data.payload.chunkIndex || 0,
          hasMore: data.payload.hasMore || false,
          isLoading: false,
        }));

        if (newProducts.length > 0) {
          toast({
            title: `Loaded ${newProducts.length} Products`,
            description: data.payload.message || `Total: ${updatedCache.length} products`,
          });
        }
      }
    },

    handleScrapeStatus: (data: WebSocketResponse) => {
      const isScraping = data.payload.status === 'scraping';
      
      setState(prev => ({
        ...prev,
        status: isScraping ? 'scraping' : 'ready',
        isLoading: isScraping,
      }));

      if (data.payload.message) {
        toast({
          title: isScraping ? 'Scraping...' : 'Ready',
          description: data.payload.message,
        });
      }
    },

    handleError: (data: WebSocketResponse) => {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: data.payload.message || 'WebSocket error',
        isLoading: false,
      }));

      toast({
        title: 'Scraping Error',
        description: data.payload.message || 'An error occurred',
        variant: 'destructive',
      });
    },

    handleConnected: () => {
      setState(prev => ({
        ...prev,
        isConnected: true,
        status: 'ready',
      }));
      
      toast({
        title: 'Connected',
        description: 'WebSocket connected successfully',
      });
    },

    handleDisconnected: () => {
      setState(prev => ({
        ...prev,
        isConnected: false,
        status: 'idle',
        isLoading: false,
      }));
      
      toast({
        title: 'Disconnected',
        description: 'WebSocket connection lost',
        variant: 'destructive',
      });
    },

    handleProgress: (data: WebSocketResponse) => {
      toast({
        title: 'Progress Update',
        description: data.payload.message,
      });
    },
  }), [toast]);

  // Setup WebSocket listeners - RUNS ONCE
  useEffect(() => {
    // Set initial state only once
    if (!initialStateSet.current) {
      setState(prev => ({
        ...prev,
        isConnected: webSocketClient.isConnected(),
        sessionId: webSocketClient.getSessionId(),
      }));
      initialStateSet.current = true;
    }

    // Register listeners
    webSocketClient.on('session-ready', eventHandlers.handleSessionReady);
    webSocketClient.on('data-chunk', eventHandlers.handleDataChunk);
    webSocketClient.on('scrape-status', eventHandlers.handleScrapeStatus);
    webSocketClient.on('error', eventHandlers.handleError);
    webSocketClient.on('connected', eventHandlers.handleConnected);
    webSocketClient.on('disconnected', eventHandlers.handleDisconnected);
    webSocketClient.on('progress', eventHandlers.handleProgress);

    // Cleanup
    return () => {
      webSocketClient.off('session-ready', eventHandlers.handleSessionReady);
      webSocketClient.off('data-chunk', eventHandlers.handleDataChunk);
      webSocketClient.off('scrape-status', eventHandlers.handleScrapeStatus);
      webSocketClient.off('error', eventHandlers.handleError);
      webSocketClient.off('connected', eventHandlers.handleConnected);
      webSocketClient.off('disconnected', eventHandlers.handleDisconnected);
      webSocketClient.off('progress', eventHandlers.handleProgress);
    };
  }, [eventHandlers]); // Only depends on eventHandlers which is memoized

  // Public methods
  const hoverNavigation = useCallback((target: string, navigationSlug?: string) => {
    setState(prev => ({ ...prev, isLoading: true }));
    webSocketClient.hoverNavigation(target, navigationSlug);
  }, []);

  const clickCategory = useCallback((target: string, categorySlug: string, navigationSlug?: string) => {
    // Set current category
    currentCategoryRef.current = categorySlug;
    
    setState(prev => ({
      ...prev,
      products: [],
      totalScraped: 0,
      currentChunk: 0,
      isLoading: true,
      currentCategory: categorySlug,
      hasMore: false,
    }));
    
    webSocketClient.clickCategory(target, categorySlug, navigationSlug);
  }, []);

  const loadMore = useCallback((target: string, categorySlug: string) => {
    if (currentCategoryRef.current !== categorySlug) {
      currentCategoryRef.current = categorySlug;
    }
    
    setState(prev => ({ ...prev, isLoading: true }));
    webSocketClient.loadMore(target, categorySlug);
  }, []);

  const getProductDetails = useCallback((sourceId: string) => {
    setState(prev => ({ ...prev, isLoading: true }));
    webSocketClient.getProductDetails(sourceId);
  }, []);

  const resetProducts = useCallback((categorySlug?: string) => {
    if (categorySlug) {
      productsCache.current.delete(categorySlug);
      if (currentCategoryRef.current === categorySlug) {
        currentCategoryRef.current = null;
      }
    } else {
      productsCache.current.clear();
      currentCategoryRef.current = null;
    }
    
    setState(prev => ({
      ...prev,
      products: [],
      totalScraped: 0,
      currentChunk: 0,
      currentCategory: null,
      hasMore: false,
    }));
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null, status: 'ready' }));
  }, []);

  const getCachedProducts = useCallback((categorySlug: string): Product[] => {
    return productsCache.current.get(categorySlug) || [];
  }, []);

  return {
    ...state,
    hoverNavigation,
    clickCategory,
    loadMore,
    getProductDetails,
    resetProducts,
    clearError,
    getCachedProducts,
  };
};