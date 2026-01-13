// frontend/src/app/products/page.tsx - COMPLETE VERSION
"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { ProductGrid } from "@/components/product/ProductGrid"
import { Breadcrumb } from "@/components/shared/Breadcrumb"
import { useProducts } from "@/lib/hooks/useProducts"
import { useCategories } from "@/lib/hooks/useCategories"
import { useNavigation } from "@/lib/hooks/useNavigation"
import { useInteractiveScraper } from "@/lib/hooks/useInteractiveScraper"
import { navigationAPI } from "@/lib/api/navigation"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import { Button } from "@/components/ui/Button"
import { ScrapeAgainButton } from "@/components/shared/ScrapeAgainButton"
import { useToast } from "@/lib/hooks/useToast"
import { RefreshCw, ArrowLeft, Loader2, ShoppingBag, Sparkles } from "lucide-react"

export default function ProductsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const categorySlug = searchParams.get('category')
  const navigationSlug = searchParams.get('navigation')
  const { toast } = useToast()

  // Existing hooks
  const { navigation } = useNavigation()
  const { categories, isLoading: isLoadingCategories } = useCategories(navigationSlug || undefined)
  const { products, isLoading: isLoadingProducts, loadProducts } = useProducts(categorySlug || undefined, {})
  
  // Interactive scraper hook
  const {
    products: wsProducts,
    totalScraped,
    status: scraperStatus,
    clickCategory,
    loadMore,
    isConnected: isWsConnected,
    resetProducts,
    getCachedProducts,
    hasMore: wsHasMore,
    isLoading: isWsLoading,
    error: wsError,
  } = useInteractiveScraper()

  // State
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false)
  const [lastRefreshTime, setLastRefreshTime] = useState(0)
  const [displayProducts, setDisplayProducts] = useState<any[]>([])
  
  // Refs
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isInitializingRef = useRef(false)
  const loadProductsRef = useRef(loadProducts)
  const startPollingRef = useRef<(() => void) | null>(null)
  const lastProductCountRef = useRef(0)
  
  // Keep refs updated
  useEffect(() => {
    loadProductsRef.current = loadProducts
  }, [loadProducts])

  const currentNav = navigation.find(nav => nav.slug === navigationSlug)
  const currentCategory = categories.find(cat => cat.slug === categorySlug)

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    currentNav && { label: currentNav.title, href: `/categories?navigation=${navigationSlug}` },
    currentCategory && { label: currentCategory.title, href: `/products?category=${categorySlug}&navigation=${navigationSlug}` }
  ].filter(Boolean)

  // Update display products based on mode
  useEffect(() => {
    if (isWsConnected && scraperStatus === 'ready' && wsProducts.length > 0) {
      setDisplayProducts(wsProducts)
    } else {
      setDisplayProducts(products)
    }
  }, [wsProducts, products, isWsConnected, scraperStatus])

  // Stop polling function
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    setIsPolling(false)
  }, [])

  // Start polling function
  const startPolling = useCallback(() => {
    if (!categorySlug) return
    
    stopPolling()
    
    setIsPolling(true)
    let pollCount = 0
    const maxPolls = 24
    lastProductCountRef.current = products.length
    
    pollingIntervalRef.current = setInterval(async () => {
      pollCount++
      
      try {
        const response = await navigationAPI.getCategoryProducts(categorySlug)
        
        const hasNewProducts = response.products && response.products.length > lastProductCountRef.current
        
        if (hasNewProducts) {
          lastProductCountRef.current = response.products.length
          stopPolling()
          setHasInitiallyLoaded(true)
          isInitializingRef.current = false
          
          await loadProductsRef.current()
          
          toast({
            title: "Products Ready!",
            description: `Loaded ${response.products.length} products`,
          })
        } else if (pollCount >= maxPolls) {
          stopPolling()
          setHasInitiallyLoaded(true)
          isInitializingRef.current = false
          
          if (response.products && response.products.length > 0) {
            await loadProductsRef.current()
          }
          
          toast({
            title: "Scraping Complete",
            description: `Found ${response.products.length} products. Some may still be loading.`,
          })
        }
      } catch (error) {
        console.error('Poll error:', error)
        if (pollCount >= maxPolls) {
          stopPolling()
          setHasInitiallyLoaded(true)
          isInitializingRef.current = false
        }
      }
    }, 5000)
  }, [categorySlug, toast, stopPolling, products.length])

  // Keep startPolling ref updated
  useEffect(() => {
    startPollingRef.current = startPolling
  }, [startPolling])

  // Load products when category changes
  useEffect(() => {
    if (!categorySlug || isInitializingRef.current) return
    
    setHasInitiallyLoaded(false)
    setIsPolling(false)
    stopPolling()
    isInitializingRef.current = true
    lastProductCountRef.current = 0
    
    const initializeProducts = async () => {
      try {
        // Check if we have cached products first
        const cachedProducts = getCachedProducts(categorySlug)
        if (cachedProducts.length > 0 && isWsConnected) {
          // Use cached WebSocket products
          setDisplayProducts(cachedProducts)
          setHasInitiallyLoaded(true)
          isInitializingRef.current = false
          return
        }
        
        // Fallback to REST API
        const result = await navigationAPI.getCategoryProducts(categorySlug)
        lastProductCountRef.current = result.products?.length || 0
        await loadProductsRef.current()
        
        await new Promise(resolve => setTimeout(resolve, 100))
        
        if (result.jobQueued && lastProductCountRef.current === 0 && startPollingRef.current) {
          startPollingRef.current()
        } else {
          setHasInitiallyLoaded(true)
          isInitializingRef.current = false
        }
      } catch (error) {
        console.error('Failed to initialize products:', error)
        setHasInitiallyLoaded(true)
        isInitializingRef.current = false
      }
    }
    
    initializeProducts()
    
    return () => {
      stopPolling()
      isInitializingRef.current = false
    }
  }, [categorySlug, stopPolling, isWsConnected, getCachedProducts])

  // Handle category change
  const handleCategoryChange = (slug: string) => {
    const category = categories.find(c => c.slug === slug)
    
    // Use interactive scraper if connected
    if (isWsConnected && scraperStatus === 'ready') {
      const target = category?.title || slug
      
      // Reset previous category products
      if (categorySlug && categorySlug !== slug) {
        resetProducts(categorySlug)
      }
      
      clickCategory(target, slug, navigationSlug || undefined)
    } else {
      // Fallback to traditional method
      toast({
        title: "Using Cached Data",
        description: "WebSocket not available, loading cached products",
      })
    }
    
    router.push(`/products?category=${slug}&navigation=${navigationSlug}`)
  }

  // Handle refresh
  const handleRefresh = async () => {
    if (!categorySlug) return
    
    const now = Date.now()
    if (now - lastRefreshTime < 3000) {
      toast({
        title: "Please Wait",
        description: "Try again in a few seconds",
      })
      return
    }
    setLastRefreshTime(now)
    
    setIsRefreshing(true)
    stopPolling()
    
    try {
      if (isWsConnected && scraperStatus === 'ready') {
        // Use interactive scraper
        const target = currentCategory?.title || categorySlug
        clickCategory(target, categorySlug, navigationSlug || undefined)
        
        toast({
          title: "Interactive Scrape Started",
          description: "Mirroring your actions on World of Books...",
        })
      } else {
        // Fallback to REST API
        await navigationAPI.getCategoryProducts(categorySlug)
        await loadProducts()
        
        toast({
          title: "Scrape Queued",
          description: "Products will update shortly",
        })
      }
    } catch (error: any) {
      toast({
        title: "Refresh Failed",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  // Handle load more
  const handleLoadMore = () => {
    if (!categorySlug || !isWsConnected || scraperStatus !== 'ready') return
    
    const target = currentCategory?.title || categorySlug
    loadMore(target, categorySlug)
  }

  if (!categorySlug) {
    return (
      <div className="space-y-8">
        <div className="text-center py-16">
          <ShoppingBag className="h-16 w-16 mx-auto mb-6 text-muted-foreground opacity-50" />
          <h1 className="text-4xl font-bold mb-4">Select a Category</h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">
            Choose a category to explore its products
          </p>
          <Button onClick={() => router.push('/')} size="lg">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </div>
      </div>
    )
  }

  // Determine loading state
  const isLoading = isLoadingProducts || isWsLoading || isPolling || (isWsConnected && scraperStatus === 'scraping')
  const showProducts = hasInitiallyLoaded && !isLoading && displayProducts.length > 0
  const showEmptyState = hasInitiallyLoaded && !isLoading && displayProducts.length === 0
  const showLoadingState = !hasInitiallyLoaded || isLoading

  return (
    <div className="space-y-8">
      <Breadcrumb items={breadcrumbItems} />

      <div className="flex items-start gap-8">
        {/* Sidebar - Category Switcher */}
        <div className="w-72 flex-shrink-0">
          <div className="sticky top-8 rounded-xl border bg-gradient-to-b from-card to-card/80 backdrop-blur-sm shadow-lg p-6 space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Categories
              </h3>
              <p className="text-xs text-muted-foreground/70">
                From: {currentNav?.title || 'Unknown'}
              </p>
            </div>
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {isLoadingCategories ? (
                <div className="flex justify-center py-6">
                  <LoadingSpinner size="sm" />
                </div>
              ) : categories.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No categories
                </p>
              ) : (
                categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => handleCategoryChange(category.slug)}
                    className={`w-full rounded-lg px-4 py-3 text-left text-sm font-medium transition-all duration-200 flex items-center justify-between ${
                      categorySlug === category.slug
                        ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md"
                        : "text-foreground hover:bg-accent/50 border border-transparent"
                    }`}
                  >
                    <span className="truncate">{category.title}</span>
                    {category.product_count > 0 && (
                      <span className="text-xs opacity-75 ml-2 flex-shrink-0 bg-white/20 px-2 py-1 rounded">
                        {category.product_count}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="mb-12">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex-1">
                <h1 className="text-5xl font-bold tracking-tight mb-3">
                  {currentCategory?.title || 'Products'}
                </h1>
                <p className="text-lg text-muted-foreground max-w-2xl">
                  {isLoading 
                    ? "Loading products..." 
                    : showProducts 
                    ? `${displayProducts.length} book${displayProducts.length !== 1 ? 's' : ''} available`
                    : "Discover books in this category"
                  }
                  {isWsConnected && (
                    <span className="ml-2 inline-flex items-center gap-1 text-sm bg-green-500/10 text-green-600 px-2 py-1 rounded">
                      <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                      Live
                    </span>
                  )}
                </p>
              </div>
              <div className="flex gap-3">
                {isWsConnected ? (
                  <ScrapeAgainButton
                    categorySlug={categorySlug}
                    categoryTitle={currentCategory?.title || categorySlug}
                    navigationSlug={navigationSlug || undefined}
                    onScrapeComplete={(newProducts) => {
                      setDisplayProducts(prev => [...prev, ...newProducts])
                    }}
                    disabled={isRefreshing || isLoading}
                  />
                ) : (
                  <Button
                    onClick={handleRefresh}
                    disabled={isRefreshing || isLoading}
                    size="lg"
                    className="gap-2"
                  >
                    {isRefreshing ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Refreshing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-5 w-5" />
                        Refresh Products
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Loading State */}
          {showLoadingState && (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="rounded-full bg-primary/10 p-6 mb-6 animate-pulse">
                <Sparkles className="h-12 w-12 text-primary animate-spin" />
              </div>
              <p className="text-xl font-semibold text-foreground">
                {isPolling || (isWsConnected && scraperStatus === 'scraping')
                  ? "Scraping Products..."
                  : "Loading Products..."
                }
              </p>
              <p className="text-muted-foreground mt-2 text-center max-w-md">
                {isWsConnected
                  ? `Mirroring ${currentCategory?.title} on World of Books...`
                  : `Loading products from ${currentCategory?.title}`
                }
              </p>
              {(isPolling || (isWsConnected && scraperStatus === 'scraping')) && (
                <div className="mt-6 text-sm text-muted-foreground">
                  <p>This may take a minute...</p>
                  {isWsConnected && (
                    <p className="mt-1">Scraped {totalScraped} products so far</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {showEmptyState && (
            <div className="rounded-xl border border-dashed bg-card/30 p-16 text-center">
              <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-lg font-medium text-foreground mb-2">
                No products found
              </p>
              <p className="text-muted-foreground mb-6">
                Try refreshing to fetch the latest products
              </p>
              <Button onClick={handleRefresh} size="lg" variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Products
              </Button>
            </div>
          )}

          {/* Products Grid */}
          {showProducts && (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">
                    {displayProducts.length} Product{displayProducts.length !== 1 ? 's' : ''}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {isWsConnected 
                      ? `${totalScraped} scraped in real-time` 
                      : 'From database cache'
                    }
                  </p>
                </div>
                
                {isWsConnected && scraperStatus === 'ready' && wsHasMore && (
                  <Button
                    onClick={handleLoadMore}
                    disabled={isWsLoading}
                    variant="outline"
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Load More ({40} more)
                  </Button>
                )}
              </div>
              
              <ProductGrid
                products={displayProducts}
                isLoading={false}
              />
              
              {/* Show Load More at bottom too */}
              {isWsConnected && scraperStatus === 'ready' && wsHasMore && displayProducts.length > 0 && (
                <div className="flex justify-center pt-8">
                  <Button
                    onClick={handleLoadMore}
                    disabled={isWsLoading}
                    size="lg"
                    className="gap-2"
                  >
                    {isWsLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading More...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        Load More Products
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}