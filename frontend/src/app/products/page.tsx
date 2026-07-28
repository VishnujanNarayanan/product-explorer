// frontend/src/app/products/page.tsx - COMPLETE VERSION
"use client"

import { useState, useEffect, useCallback, useRef, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { ProductGrid } from "@/components/product/ProductGrid"
import { Breadcrumb } from "@/components/shared/Breadcrumb"
import { SideRail } from "@/components/layout/SideRail"
import { useProducts } from "@/lib/hooks/useProducts"
import { useCategories } from "@/lib/hooks/useCategories"
import { useNavigation } from "@/lib/hooks/useNavigation"
import { useInteractiveScraper } from "@/lib/hooks/useInteractiveScraper"
import { navigationAPI } from "@/lib/api/navigation"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import { Button } from "@/components/ui/Button"
import { ScrapeAgainButton } from "@/components/shared/ScrapeAgainButton"
import { useToast } from "@/lib/hooks/useToast"
import { RefreshCw, ArrowLeft, Loader2, ShoppingBag } from "lucide-react"

function ProductsPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const categorySlug = searchParams.get('category')
  const navigationSlug = searchParams.get('navigation')
  const { toast } = useToast()

  // Existing hooks
  const { navigation } = useNavigation()
  const { categories, isLoading: isLoadingCategories } = useCategories(navigationSlug || undefined)
  const { products, isLoading: isLoadingProducts, loadProducts } = useProducts(
    categorySlug || undefined,
    {},
    navigationSlug || undefined,
  )
  
  // Interactive scraper hook
  const {
    products: wsProducts,
    totalScraped,
    status: scraperStatus,
    clickCategory,
    loadMore,
    isConnected: isWsConnected,
    currentCategory: wsCategory,
    resetProducts,
    hasMore: wsHasMore,
    isLoading: isWsLoading,
    error: _wsError,
    statusMessage: wsStatusMessage,
    step: wsStep,
    attempt: wsAttempt,
    maxAttempts: wsMaxAttempts,
    source: wsSource,
    stillWorking: wsStillWorking,
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
  // Category slug we have already asked the live browser session to click, so the
  // request fires once per category rather than on every status change.
  const liveRequestedRef = useRef<string | null>(null)
  const isWsConnectedRef = useRef(isWsConnected)
  // Category whose live attempt has already been handed over to background polling, so the
  // handover happens once per category rather than on every status update.
  const fallbackPolledRef = useRef<string | null>(null)

  // Keep refs updated
  useEffect(() => {
    loadProductsRef.current = loadProducts
  }, [loadProducts])

  useEffect(() => {
    isWsConnectedRef.current = isWsConnected
  }, [isWsConnected])

  const currentNav = navigation.find(nav => nav.slug === navigationSlug)
  const currentCategory = categories.find(cat => cat.slug === categorySlug)

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    currentNav && { label: currentNav.title, href: `/categories?navigation=${navigationSlug}` },
    currentCategory && { label: currentCategory.title, href: `/products?category=${categorySlug}&navigation=${navigationSlug}` }
  ].filter(Boolean)

  // Update display products based on mode. Live results win, but only once they belong to
  // the category currently on screen.
  useEffect(() => {
    if (isWsConnected && wsCategory === categorySlug && wsProducts.length > 0) {
      setDisplayProducts(wsProducts)
    } else {
      setDisplayProducts(products)
    }
  }, [wsProducts, products, isWsConnected, wsCategory, categorySlug])

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
        const response = await navigationAPI.getCategoryProducts(categorySlug, navigationSlug || undefined)
        
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
  }, [categorySlug, navigationSlug, toast, stopPolling, products.length])

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
        // Paint whatever is already stored so the grid is not blank while the live
        // browser session works through hover -> click -> scrape.
        const result = await navigationAPI.getCategoryProducts(categorySlug, navigationSlug || undefined)
        lastProductCountRef.current = result.products?.length || 0
        await loadProductsRef.current()

        await new Promise(resolve => setTimeout(resolve, 100))

        // Polling is the no-WebSocket fallback; the live session pushes DATA_CHUNK instead.
        if (
          !isWsConnectedRef.current &&
          result.jobQueued &&
          lastProductCountRef.current === 0 &&
          startPollingRef.current
        ) {
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
  }, [categorySlug, navigationSlug, stopPolling])

  // Drive the real browser session: clicking a category here clicks it on World of Books.
  // Runs when the category changes and also when the socket becomes ready afterwards, so
  // arriving from a category card scrapes live instead of only showing stored products.
  useEffect(() => {
    if (!categorySlug) return
    if (!isWsConnected || scraperStatus !== 'ready') return
    if (liveRequestedRef.current === categorySlug) return

    liveRequestedRef.current = categorySlug
    fallbackPolledRef.current = null
    clickCategory(currentCategory?.title || categorySlug, categorySlug, navigationSlug || undefined)
  }, [categorySlug, navigationSlug, isWsConnected, scraperStatus, currentCategory, clickCategory])

  // When the live attempt ends on stored data, the queued listing scrape is still running —
  // it is what made "wait a while, or hit Refresh" work. Poll for it instead of leaving the
  // grid frozen on a message the user has to act on themselves.
  useEffect(() => {
    if (!categorySlug || wsSource !== 'stored' || !wsStillWorking) return
    // The outcome has to belong to the category on screen: switching categories leaves the
    // previous result in state for a moment, and polling on that would report the wrong
    // category as still fetching.
    if (wsCategory !== categorySlug) return
    if (fallbackPolledRef.current === categorySlug) return

    fallbackPolledRef.current = categorySlug
    startPollingRef.current?.()
  }, [categorySlug, wsCategory, wsSource, wsStillWorking])

  // Handle category change. Every click is a request for fresh data — including clicking
  // the category already open, which is how you ask for a re-scrape.
  const handleCategoryChange = (slug: string) => {
    // Drop held results so the grid cannot show the previous category's books, and clear
    // the guard so the live-scrape effect fires again.
    if (categorySlug) resetProducts(categorySlug)
    resetProducts(slug)
    liveRequestedRef.current = null
    fallbackPolledRef.current = null

    if (!isWsConnected) {
      toast({
        title: "Offline Mode",
        description: "Live browser session unavailable — showing stored products",
      })
    }

    if (slug === categorySlug) {
      // Same category: the URL will not change, so nothing would re-trigger the effect.
      if (isWsConnected && scraperStatus === 'ready') {
        liveRequestedRef.current = slug
        clickCategory(currentCategory?.title || slug, slug, navigationSlug || undefined)
      }
      return
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
        await navigationAPI.getCategoryProducts(categorySlug, navigationSlug || undefined)
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

  // Anything in flight: a live click, a REST load, or the background poll that follows a
  // fallback.
  const isWorking =
    isLoadingProducts || isWsLoading || isPolling || (isWsConnected && scraperStatus === 'scraping')
  const hasSomethingToShow = displayProducts.length > 0

  // Take over the screen only when there is nothing to look at yet. Once products are on
  // screen, further work is reported in a banner above them — replacing a populated grid
  // with a spinner is what made a working background scrape look like a stalled one.
  const showLoadingState = (!hasInitiallyLoaded || isWorking) && !hasSomethingToShow
  const isWorkingInBackground = isWorking && hasSomethingToShow
  const showProducts = hasSomethingToShow
  const showEmptyState = hasInitiallyLoaded && !isWorking && !hasSomethingToShow
  const isLoading = showLoadingState

  // What the system is doing, in one line. Falls back to a plain description when the live
  // session has not said anything yet.
  const progressLine =
    wsStatusMessage ||
    (isPolling
      ? 'Fetching from the background scrape…'
      : `Loading products from ${currentCategory?.title || 'this category'}…`)
  const retryLine =
    wsStep === 'retrying' && wsAttempt && wsMaxAttempts
      ? `Attempt ${wsAttempt} of ${wsMaxAttempts}`
      : null

  return (
    <div className="container space-y-8 py-8">
      <Breadcrumb items={breadcrumbItems} />

      <div className="flex flex-col items-start gap-10 lg:flex-row">
        <SideRail
          label="Categories"
          context={currentNav?.title}
          isLoading={isLoadingCategories}
          emptyMessage="No categories stored for this section"
          items={categories.map((category) => ({
            id: category.id,
            title: category.title,
            count: category.product_count,
            isActive: categorySlug === category.slug,
          }))}
          onSelect={(item) => {
            const category = categories.find((c) => c.id === item.id)
            if (category) handleCategoryChange(category.slug)
          }}
        />

        {/* Main Content */}
        <div className="min-w-0 flex-1">
          {/* Header */}
          <div className="mb-10 border-b pb-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex-1">
                <p className="label-meta">{currentNav?.title || 'Catalogue'}</p>
                <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">
                  {currentCategory?.title || 'Products'}
                </h1>
                <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span>
                    {isLoading
                      ? 'Loading books…'
                      : showProducts
                        ? `${displayProducts.length} book${displayProducts.length !== 1 ? 's' : ''} on this page`
                        : 'No books yet'}
                  </span>
                  <span aria-hidden>·</span>
                  <span>
                    {isWsConnected
                      ? `${totalScraped} scraped in this session`
                      : 'served from storage'}
                  </span>
                </p>
              </div>
              <div className="flex gap-3">
                {isWsConnected ? (
                  <ScrapeAgainButton
                    categorySlug={categorySlug}
                    categoryTitle={currentCategory?.title || categorySlug}
                    navigationSlug={navigationSlug || undefined}
                    onScrapeComplete={(newProducts) => {
                      // Merge on source_id: the REST fallback returns the whole stored page,
                      // which overlaps what is already on screen.
                      setDisplayProducts(prev => {
                        const seen = new Set(prev.map((p: any) => p.source_id))
                        return [...prev, ...newProducts.filter((p: any) => !seen.has(p.source_id))]
                      })
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

          {/* Working, with nothing on screen yet. Skeleton tiles rather than a spinner, so
              the page keeps the shape of what is about to arrive. */}
          {showLoadingState && (
            <div className="space-y-8">
              <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
                <Loader2 className="mt-0.5 h-4 w-4 flex-shrink-0 animate-spin text-primary" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {isPolling || (isWsConnected && scraperStatus === 'scraping')
                      ? 'Walking the category on World of Books'
                      : 'Loading books'}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{progressLine}</p>
                  <p className="mt-1 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground">
                    {retryLine ? `${retryLine} · ` : ''}
                    {isWsConnected && totalScraped > 0
                      ? `${totalScraped} scraped so far`
                      : 'this usually takes under a minute'}
                  </p>
                </div>
              </div>

              <div className="grid gap-5 grid-cols-2 sm:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="overflow-hidden rounded-lg border">
                    <div className="skeleton aspect-[3/4] rounded-none" />
                    <div className="space-y-2 border-t p-4">
                      <div className="skeleton h-4" />
                      <div className="skeleton h-3 w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {showEmptyState && (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <p className="font-medium">The scrape came back empty</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                World of Books returned no books for this category. Asking again sometimes
                helps — the listing is paged and the first page can be empty.
              </p>
              <Button onClick={handleRefresh} className="mt-6" variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Ask again
              </Button>
            </div>
          )}

          {/* Still working, with products already on screen. Says plainly that more is
              coming, so a fallback to stored data does not read as a dead end. */}
          {isWorkingInBackground && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border-l-2 border-l-highlight bg-secondary/60 p-4">
              <Loader2 className="mt-0.5 h-4 w-4 flex-shrink-0 animate-spin text-highlight" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {wsSource === 'stored'
                    ? 'Showing stored books while the scrape continues'
                    : 'Still fetching more books'}
                </p>
                <p className="text-sm text-muted-foreground">{progressLine}</p>
                {retryLine && (
                  <p className="mt-1 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground">
                    {retryLine}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Products Grid */}
          {showProducts && (
            <div className="space-y-8">
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

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <ProductsPageContent />
    </Suspense>
  )
}