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
import { useBrowserScrape } from "@/lib/hooks/useBrowserScrape"
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

  // Live scraping from the visitor's own browser — the only path to World of Books that works
  // from production, since the API's address is rate-limited by the storefront.
  const {
    scrape: browserScrape,
    isScraping: isBrowserScraping,
    message: browserScrapeMessage,
    step: browserScrapeStep,
    sessionScraped: browserSessionScraped,
  } = useBrowserScrape()

  // Books fetched from World of Books since this page loaded, whichever path fetched them.
  // Reading only the live session's counter meant a grid filled by this browser reported "0
  // scraped in this session" beside forty books it had just scraped — true of that one counter,
  // and the opposite of what the line is telling someone.
  const scrapedThisSession = totalScraped + browserSessionScraped

  // State
  // Category whose grid holds books this browser scraped, so stored rows do not overwrite them.
  const [liveSlug, setLiveSlug] = useState<string | null>(null)
  const [sourceHasMore, setSourceHasMore] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false)
  const [lastRefreshTime, setLastRefreshTime] = useState(0)
  const [displayProducts, setDisplayProducts] = useState<any[]>([])
  
  // Refs
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  // The category currently being initialised. A boolean here meant that clicking a second
  // category while the first was still loading hit the early return below, so the new
  // category never initialised and the old books stayed on screen.
  const initializingSlugRef = useRef<string | null>(null)
  const loadProductsRef = useRef(loadProducts)
  const startPollingRef = useRef<(() => void) | null>(null)
  const lastProductCountRef = useRef(0)
  // Category slug we have already asked the live browser session to click, so the
  // request fires once per category rather than on every status change.
  const liveRequestedRef = useRef<string | null>(null)
  const isWsConnectedRef = useRef(isWsConnected)
  // Held in refs so the initialise effect can call the scraper without listing it as a
  // dependency — it changes identity on every state update, and re-running that effect would
  // clear the grid mid-scrape.
  const browserScrapeRef = useRef(browserScrape)
  const currentCategoryTitleRef = useRef<string | undefined>(undefined)
  // Category whose live attempt has already been handed over to background polling, so the
  // handover happens once per category rather than on every status update.
  const fallbackPolledRef = useRef<string | null>(null)
  // The category the products held by useProducts belong to. They are the previous
  // category's until the refetch lands, and painting those under the new heading is what
  // made switching mid-load look like nothing had happened.
  const loadedSlugRef = useRef<string | null>(null)

  // Keep refs updated
  useEffect(() => {
    loadProductsRef.current = loadProducts
  }, [loadProducts])

  useEffect(() => {
    isWsConnectedRef.current = isWsConnected
  }, [isWsConnected])

  useEffect(() => {
    browserScrapeRef.current = browserScrape
  }, [browserScrape])

  const currentNav = navigation.find(nav => nav.slug === navigationSlug)
  const currentCategory = categories.find(cat => cat.slug === categorySlug)

  useEffect(() => {
    currentCategoryTitleRef.current = currentCategory?.title
  }, [currentCategory])

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
    } else if (liveSlug === categorySlug) {
      // Books this browser scraped for the category on screen, plus any pages added since.
      // Stored rows must not replace them — a later `products` update would otherwise drop
      // everything "load more" had appended.
    } else if (loadedSlugRef.current === categorySlug) {
      setDisplayProducts(products)
    } else {
      // Nothing on screen belongs to this category yet: show the loading state rather than
      // the last category's books.
      setDisplayProducts([])
    }
  }, [wsProducts, products, isWsConnected, wsCategory, categorySlug, liveSlug])

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
          initializingSlugRef.current = null
          
          await loadProductsRef.current()
          loadedSlugRef.current = categorySlug

          toast({
            title: "Products Ready!",
            description: `Loaded ${response.products.length} products`,
          })
        } else if (pollCount >= maxPolls) {
          stopPolling()
          setHasInitiallyLoaded(true)
          initializingSlugRef.current = null
          
          if (response.products && response.products.length > 0) {
            await loadProductsRef.current()
            loadedSlugRef.current = categorySlug
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
          initializingSlugRef.current = null
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
    if (!categorySlug || initializingSlugRef.current === categorySlug) return
    
    setHasInitiallyLoaded(false)
    setIsPolling(false)
    stopPolling()
    initializingSlugRef.current = categorySlug
    lastProductCountRef.current = 0
    loadedSlugRef.current = null
    setLiveSlug(null)
    setDisplayProducts([])
    
    const initializeProducts = async () => {
      try {
        // Scrape first, and show nothing until it answers. Painting stored books immediately
        // meant a category with a page already saved never scraped at all — the visitor saw a
        // cached grid appear instantly and no scraping happen, which is the opposite of what
        // this page is for. Storage is the fallback for when the storefront cannot be reached,
        // not the thing shown while it can.
        const live = await browserScrapeRef.current(categorySlug, {
          categoryTitle: currentCategoryTitleRef.current,
          navigationSlug: navigationSlug || undefined,
        })

        if (live.length > 0) {
          setDisplayProducts(live)
          setLiveSlug(categorySlug)
          lastProductCountRef.current = live.length
          setHasInitiallyLoaded(true)
          initializingSlugRef.current = null

          // Only for whether the collection has pages left, so "load more" knows. Deliberately
          // not awaited: the books are already on screen and this must not hold them up.
          navigationAPI
            .getCategoryProducts(categorySlug, navigationSlug || undefined)
            .then(result => setSourceHasMore(result.sourceHasMore ?? true))
            .catch(() => setSourceHasMore(true))
          return
        }

        // The scrape found nothing, or this browser was refused. Fall back to what is stored.
        const result = await navigationAPI.getCategoryProducts(categorySlug, navigationSlug || undefined)
        lastProductCountRef.current = result.products?.length || 0
        await loadProductsRef.current()
        loadedSlugRef.current = categorySlug

        setSourceHasMore(result.sourceHasMore ?? false)

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
          initializingSlugRef.current = null
        }
      } catch (error) {
        console.error('Failed to initialize products:', error)
        setHasInitiallyLoaded(true)
        initializingSlugRef.current = null
      }
    }

    initializeProducts()

    return () => {
      stopPolling()
    }
    // `toast` is stable by construction (useToast wraps it in useCallback with no deps), so it
    // can sit here without re-running this effect and resetting the grid on every render.
  }, [categorySlug, navigationSlug, stopPolling, toast])

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

  // The live session drives a headless browser on the server, which a small instance cannot
  // start — so on this deployment it ends on stored data or an error every time. It used to
  // hand over to polling, waiting on a queued scrape that needs both a worker and an address
  // World of Books will answer; here it is neither. Take the feed in this browser instead,
  // which is the one path that does work.
  useEffect(() => {
    if (!categorySlug) return
    // The outcome has to belong to the category on screen: switching categories leaves the
    // previous result in state for a moment, and acting on it would scrape the wrong one.
    if (wsCategory !== categorySlug) return
    if (wsSource !== 'stored' && scraperStatus !== 'error') return
    if (fallbackPolledRef.current === categorySlug) return

    fallbackPolledRef.current = categorySlug

    browserScrapeRef.current(categorySlug, {
      categoryTitle: currentCategoryTitleRef.current,
      navigationSlug: navigationSlug || undefined,
    }).then(scraped => {
      if (scraped.length > 0) {
        setDisplayProducts(scraped)
        setLiveSlug(categorySlug)
      }
    })
  }, [categorySlug, navigationSlug, wsCategory, wsSource, wsStillWorking, scraperStatus])

  // Handle category change. Every click is a request for fresh data — including clicking
  // the category already open, which is how you ask for a re-scrape.
  const handleCategoryChange = (slug: string) => {
    // Drop held results so the grid cannot show the previous category's books, and clear
    // the guard so the live-scrape effect fires again.
    if (categorySlug) resetProducts(categorySlug)
    resetProducts(slug)
    liveRequestedRef.current = null
    fallbackPolledRef.current = null

    const title = categories.find((c) => c.slug === slug)?.title || slug

    // Clicking a second category while the first is still working used to look like
    // nothing had happened: the old books stayed on screen and the banner still named the
    // old category. Say straight away which one is being fetched now.
    toast({
      title: isWsConnected ? `Opening ${title}` : `Loading ${title}`,
      description: isWsConnected
        ? "Picking the category on World of Books…"
        : "No live session — showing stored books for this category",
    })

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

  // Scrape this category here and now, bypassing the live session entirely. Offered where
  // that session has already had its turn and produced nothing.
  const handleScrapeHere = async () => {
    if (!categorySlug) return

    const scraped = await browserScrape(categorySlug, {
      categoryTitle: currentCategory?.title || categorySlug,
      navigationSlug: navigationSlug || undefined,
    })

    if (scraped.length > 0) {
      setDisplayProducts(scraped)
      setLiveSlug(categorySlug)
    }
  }

  // Handle load more
  const handleLoadMore = async () => {
    if (!categorySlug) return

    const target = currentCategory?.title || categorySlug

    // The live browser session pushes results as they arrive, so prefer it when it is actually
    // running. It needs a headless Chromium on the server, which a small instance cannot start.
    if (isWsConnected && scraperStatus === 'ready') {
      loadMore(target, categorySlug)
      return
    }

    // Otherwise take the next feed page here. This is what makes "load more" work at all in
    // production: no session, no queue, just this browser asking the storefront for page n+1.
    const more = await browserScrape(categorySlug, {
      categoryTitle: target,
      navigationSlug: navigationSlug || undefined,
      nextPage: true,
    })

    if (more.length > 0) {
      // Appended rather than replacing: "load more" should grow the grid, and the books
      // already on screen came from earlier pages of the same collection.
      setDisplayProducts(prev => {
        const seen = new Set(prev.map((product: any) => product.source_id))
        return [...prev, ...more.filter(product => !seen.has(product.source_id))]
      })
      // Claims the grid, so a later stored-products update cannot drop the appended pages.
      setLiveSlug(categorySlug)
    }
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
    isLoadingProducts ||
    isWsLoading ||
    isPolling ||
    isBrowserScraping ||
    (isWsConnected && scraperStatus === 'scraping')
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
  // The browser's own scrape comes first: it is the one actually happening in production, and
  // it reports each step — fetching from the storefront, then saving what came back.
  const progressLine =
    (isBrowserScraping || browserScrapeStep === 'failed' ? browserScrapeMessage : null) ||
    (wsCategory === categorySlug ? wsStatusMessage : null) ||
    (isPolling
      ? 'Fetching from the background scrape…'
      : `Loading products from ${currentCategory?.title || 'this category'}…`)
  const retryLine =
    wsStep === 'retrying' && wsAttempt && wsMaxAttempts
      ? `Attempt ${wsAttempt} of ${wsMaxAttempts}`
      : null

  // Kept mounted while the fetch runs — a control that disappears the moment you press it
  // makes the page jump and leaves you unsure the press registered. handleLoadMore is the
  // one that insists the session is ready.
  // Offered whenever the collection has pages left, not only when a live browser session is
  // running — that session cannot start on a small instance, and gating the control on it hid
  // "load more" from every visitor in production.
  const canLoadMore =
    displayProducts.length > 0 && ((isWsConnected && wsHasMore) || sourceHasMore)
  const isLoadingMore =
    isWsLoading || (isWsConnected && scraperStatus === 'scraping') || isBrowserScraping

  // One report, rendered at both ends of the grid.
  const categoryName = currentCategory?.title || 'this category'
  const bannerProps = {
    // Naming the category matters most when you have just switched to another one while
    // the first was still going.
    title: isWsLoading
      ? displayProducts.length === 0
        ? `Opening ${categoryName}`
        : `Fetching more books from ${categoryName}`
      : wsSource === 'stored'
        ? 'Showing stored books while the scrape continues'
        : `Still fetching more books from ${categoryName}`,
    line: progressLine,
    retryLine,
  }

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
                    {scrapedThisSession > 0
                      ? `${scrapedThisSession} scraped in this session`
                      : 'served from storage'}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {/* Load more is offered at both ends of the grid: after forty covers the
                    bottom control is a long scroll away from where you started reading. */}
                {canLoadMore && (
                  <LoadMoreButton
                    onClick={handleLoadMore}
                    isLoading={isLoadingMore}
                    variant="outline"
                  />
                )}
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
                      if (categorySlug) setLiveSlug(categorySlug)
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
                    {scrapedThisSession > 0
                      ? `${scrapedThisSession} scraped so far`
                      : 'this usually takes under a minute'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 sm:gap-5 xl:grid-cols-4 2xl:grid-cols-5">
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
              <p className="font-medium">No books came back for this category</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                World of Books returned nothing for it. Asking again sometimes helps — the
                listing is paged, and the first page can be empty.
              </p>
              {/* Deliberately not handleRefresh, which prefers the live browser session: the
                  empty state is mostly reached because that session could not deliver, and
                  offering the same route again is offering the thing that just failed. */}
              <Button onClick={handleScrapeHere} className="mt-6" variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Scrape it in my browser
              </Button>
            </div>
          )}

          {/* Still working, with books already on screen. Says plainly that more is
              coming, so a fallback to stored data does not read as a dead end. */}
          {isWorkingInBackground && <WorkingBanner {...bannerProps} className="mb-6" />}

          {/* Products Grid */}
          {showProducts && (
            <div className="space-y-8">
              <ProductGrid
                products={displayProducts}
                isLoading={false}
              />

              {/* The same report again at the foot of the grid. Load more lives down here,
                  so this is where its progress has to appear — reporting it only at the top
                  of a page of forty covers tells you nothing about the button you pressed. */}
              {isWorkingInBackground && <WorkingBanner {...bannerProps} />}

              {canLoadMore && (
                <div className="flex justify-center pt-2">
                  <LoadMoreButton
                    onClick={handleLoadMore}
                    isLoading={isLoadingMore}
                    size="lg"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * What the scraper is doing, in the same words wherever it appears. Rendered above and
 * below the grid so the report is never off-screen from the control that started it.
 */
function WorkingBanner({
  title,
  line,
  retryLine,
  className,
}: {
  title: string
  line: string
  retryLine: string | null
  className?: string
}) {
  return (
    <div
      aria-live="polite"
      className={`flex items-start gap-3 rounded-lg border-l-2 border-l-highlight bg-secondary/60 p-4 ${className || ''}`}
    >
      <Loader2 className="mt-0.5 h-4 w-4 flex-shrink-0 animate-spin text-highlight" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{line}</p>
        {retryLine && (
          <p className="mt-1 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground">
            {retryLine}
          </p>
        )}
      </div>
    </div>
  )
}

function LoadMoreButton({
  onClick,
  isLoading,
  size,
  variant,
}: {
  onClick: () => void
  isLoading: boolean
  size?: "default" | "lg"
  variant?: "default" | "outline"
}) {
  return (
    <Button onClick={onClick} disabled={isLoading} size={size} variant={variant} className="gap-2">
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading more books…
        </>
      ) : (
        <>
          <RefreshCw className="h-4 w-4" />
          Load more books
        </>
      )}
    </Button>
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