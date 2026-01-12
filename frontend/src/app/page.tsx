"use client"

import { NavigationGrid } from '@/components/navigation/NavigationGrid'
import { CategoryGrid } from '@/components/category/CategoryGrid'
import { useNavigation } from '@/lib/hooks/useNavigation'
import { useCategories } from '@/lib/hooks/useCategories'
import { Button } from '@/components/ui/Button'
import { RefreshCw } from 'lucide-react'
import { useToast } from '@/lib/hooks/useToast'
import { navigationAPI } from '@/lib/api/navigation'

export default function Home() {
  const { navigation, isLoading, error, refreshNavigation } = useNavigation()
  const { categories } = useCategories()
  const { toast } = useToast()

  const handleRefreshAll = async () => {
    try {
      await refreshNavigation()
      toast({
        title: "Success",
        description: "Navigation data refreshed successfully"
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to refresh navigation",
        variant: "destructive"
      })
    }
  }

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight lg:text-5xl">
          World of Books Explorer
        </h1>
        <p className="text-xl text-muted-foreground">
          Explore thousands of books with real-time scraping
        </p>
        <div className="flex justify-center gap-4">
          <Button onClick={handleRefreshAll} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh All Data
          </Button>
        </div>
      </section>

      {/* Navigation Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold">Browse Categories</h2>
          <span className="text-sm text-muted-foreground">
            {navigation.length} navigation items
          </span>
        </div>
        <NavigationGrid navigation={navigation} isLoading={isLoading} />
      </section>

      {/* Popular Categories */}
      {categories.length > 0 && (
        <section>
          <h2 className="text-3xl font-bold mb-6">Popular Categories</h2>
          <CategoryGrid 
            categories={categories.slice(0, 8)} 
            title=""
            showAll={false}
          />
        </section>
      )}

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border p-6 text-center">
          <div className="text-3xl font-bold">{navigation.length}</div>
          <div className="text-sm text-muted-foreground">Navigation Items</div>
        </div>
        <div className="rounded-lg border p-6 text-center">
          <div className="text-3xl font-bold">{categories.length}</div>
          <div className="text-sm text-muted-foreground">Categories</div>
        </div>
        <div className="rounded-lg border p-6 text-center">
          <div className="text-3xl font-bold">Live</div>
          <div className="text-sm text-muted-foreground">Scraping</div>
        </div>
        <div className="rounded-lg border p-6 text-center">
          <div className="text-3xl font-bold">1000+</div>
          <div className="text-sm text-muted-foreground">Books Available</div>
        </div>
      </section>
    </div>
  )
}