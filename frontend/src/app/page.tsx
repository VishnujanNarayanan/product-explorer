"use client"

import { useState, useEffect } from 'react'
import { NavigationGrid } from '@/components/navigation/NavigationGrid'
import { useNavigation } from '@/lib/hooks/useNavigation'
import { Button } from '@/components/ui/Button'
import { RefreshCw, Loader2 } from 'lucide-react'
import { useToast } from '@/lib/hooks/useToast'



export default function Home() {
  const { navigation, isLoading, error, refreshNavigation } = useNavigation()
  const { toast } = useToast()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [hasAttemptedRefresh, setHasAttemptedRefresh] = useState(false)
  useEffect(() => {
  // Initialize WebSocket connection on homepage load
    const initWebSocket = () => {
      if (typeof window !== 'undefined') {
        // The WebSocket client auto-connects on import
        console.log('WebSocket client initialized')
      }
    }
    
    initWebSocket()
  }, [])
  useEffect(() => {
    // Auto-scrape navigation when page loads if empty (only once)
    if (!isLoading && !isRefreshing && navigation.length === 0 && !hasAttemptedRefresh) {
      setHasAttemptedRefresh(true)
      handleRefreshAll()
    }
  }, [isLoading, isRefreshing])

  const handleRefreshAll = async () => {
    setIsRefreshing(true)
    try {
      const result = await refreshNavigation()
      // Check if we got data back
      if (result?.data && result.data.length > 0) {
        toast({
          title: "Navigation Updated",
          description: `Loaded ${result.data.length} navigation items`
        })
      } else {
        toast({
          title: "Refresh Queued",
          description: "Scraping started in background. Refreshing page...",
        })
        // Wait a moment then revalidate
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to refresh navigation",
        variant: "destructive"
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center space-y-6">
        <div>
          <h1 className="text-5xl font-bold tracking-tight lg:text-6xl">
            World of Books Explorer
          </h1>
          <p className="mt-4 text-xl text-muted-foreground max-w-2xl mx-auto">
            Discover and explore thousands of books across multiple categories with real-time data
          </p>
        </div>
        <div className="flex justify-center gap-4 pt-4">
          <Button 
            onClick={handleRefreshAll} 
            disabled={isRefreshing || isLoading}
            size="lg"
          >
            {isRefreshing || isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading Navigation...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Navigation
              </>
            )}
          </Button>
        </div>
      </section>

      {/* Loading State */}
      {(isLoading || isRefreshing) && navigation.length === 0 && (
        <section className="text-center py-12">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-lg text-muted-foreground">
            Loading navigation items from World of Books...
          </p>
        </section>
      )}

      {/* Error State */}
      {error && navigation.length === 0 && (
        <section className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center">
          <p className="text-destructive mb-4">Failed to load navigation items</p>
          <Button onClick={handleRefreshAll} variant="outline">
            Try Again
          </Button>
        </section>
      )}

      {/* Navigation Section */}
      {!isLoading && navigation.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-4xl font-bold">Browse Categories</h2>
              <p className="mt-2 text-muted-foreground">
                Click on any category to explore its subcategories
              </p>
            </div>
            <span className="text-2xl font-bold text-primary">
              {navigation.length} Sections
            </span>
          </div>
          <NavigationGrid navigation={navigation} isLoading={false} />
        </section>
      )}

      {/* Stats Section */}
      {!isLoading && navigation.length > 0 && (
        <section>
          <h2 className="text-3xl font-bold mb-6">Quick Stats</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-lg border bg-card p-6 text-center hover:border-primary/30 transition-colors">
              <div className="text-4xl font-bold text-primary">{navigation.length}</div>
              <div className="text-sm text-muted-foreground mt-2">Navigation Sections</div>
            </div>
            <div className="rounded-lg border bg-card p-6 text-center hover:border-primary/30 transition-colors">
              <div className="text-4xl font-bold text-primary">
                {navigation.reduce((acc, nav) => acc + (nav.categories?.length || 0), 0)}
              </div>
              <div className="text-sm text-muted-foreground mt-2">Total Categories</div>
            </div>
            <div className="rounded-lg border bg-card p-6 text-center hover:border-primary/30 transition-colors">
              <div className="text-4xl font-bold text-primary">Live</div>
              <div className="text-sm text-muted-foreground mt-2">Real-time Updates</div>
            </div>
            <div className="rounded-lg border bg-card p-6 text-center hover:border-primary/30 transition-colors">
              <div className="text-4xl font-bold text-primary">1000+</div>
              <div className="text-sm text-muted-foreground mt-2">Books Available</div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}