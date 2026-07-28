// frontend/src/lib/hooks/useInteractiveScraper.ts (FULL CORRECTED)
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { webSocketClient, WebSocketResponse, ScrapeStep } from '@/lib/api/websocket';
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
  /**
   * What the session is doing right now, in the site's own words. Shown inline rather than
   * as a toast: a long action goes through several steps and retries, and firing a toast per
   * step buried the outcome under notifications that each looked like a verdict.
   */
  statusMessage: string | null;
  step: ScrapeStep | null;
  attempt: number | null;
  maxAttempts: number | null;
  /** Where the products on screen came from once an action finished. */
  source: 'live' | 'stored' | null;
  /** True when a queued scrape is still expected to add to what is shown. */
  stillWorking: boolean;
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
    statusMessage: null,
    step: null,
    attempt: null,
    maxAttempts: null,
    source: null,
    stillWorking: false,
  });

  const productsCache = useRef<Map<string, Product[]>>(new Map());
  const currentCategoryRef = useRef<string | null>(null);

  // Memoize event handlers to prevent re-creation
  const eventHandlers = useMemo(() => ({
    handleSessionReady: (data: WebSocketResponse) => {
      setState(prev => ({
        ...prev,
        isConnected: true,
        sessionId: data.payload.sessionId || null,
        status: 'ready',
      }));
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
      const { status, step, message, attempt, maxAttempts, source, stillWorking } = data.payload;
      const isScraping = status === 'scraping';

      setState(prev => ({
        ...prev,
        // 'preparing' is groundwork for a click that has not been asked for yet (the menu
        // pre-warm fired from a category card); it must not put the UI into a loading state
        // of its own or clear what a finished action reported.
        status: step === 'preparing' ? prev.status : isScraping ? 'scraping' : 'ready',
        isLoading: step === 'preparing' ? prev.isLoading : isScraping,
        statusMessage: message ?? prev.statusMessage,
        step: step ?? prev.step,
        attempt: attempt ?? (isScraping ? prev.attempt : null),
        maxAttempts: maxAttempts ?? (isScraping ? prev.maxAttempts : null),
        source: source ?? (isScraping ? prev.source : prev.source),
        stillWorking: stillWorking ?? (isScraping ? prev.stillWorking : false),
      }));

      // Only the end of an action is worth interrupting the user for, and only when it
      // changes what they are looking at. Steps and retries show up inline instead.
      if (step === 'fallback' && message) {
        toast({
          title: 'Still fetching',
          description: message,
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
      setState(prev => ({ ...prev, statusMessage: data.payload.message ?? prev.statusMessage }));
    },
  }), [toast]);

  // Setup WebSocket listeners - RUNS ONCE
  useEffect(() => {
    // Sync with the socket singleton on every mount. The socket usually connects while the
    // first page is still rendering, so a component mounting later (e.g. /products reached
    // from a category card) never sees 'connected'/'session-ready' fire and would otherwise
    // sit at status 'idle' forever, falling back to cached data.
    setState(prev => ({
      ...prev,
      isConnected: webSocketClient.isConnected(),
      sessionId: webSocketClient.getSessionId(),
      status: webSocketClient.isSessionReady() ? 'ready' : prev.status,
    }));

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
  // Preparation only — opening a section's menu ahead of a click. It deliberately does not
  // set a loading state: nothing the user asked for is pending, and a pre-warm that never
  // reports back would otherwise leave the page spinning.
  const hoverNavigation = useCallback((target: string, navigationSlug?: string) => {
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
      status: 'scraping',
      currentCategory: categorySlug,
      hasMore: false,
      statusMessage: 'Opening the live browser session…',
      step: 'preparing',
      attempt: null,
      maxAttempts: null,
      source: null,
      stillWorking: false,
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