"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { CategoryCard } from "@/components/category/CategoryCard"
import { useCategories } from "@/lib/hooks/useCategories"
import { useNavigation } from "@/lib/hooks/useNavigation"
import { Breadcrumb } from "@/components/shared/Breadcrumb"
import { navigationAPI } from "@/lib/api/navigation"
import { useToast } from "@/lib/hooks/useToast"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import { Button } from "@/components/ui/Button"
import { RefreshCw, ArrowLeft, Loader2, LayoutGrid } from "lucide-react"

export default function CategoriesPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const navigationSlug = searchParams.get('navigation')
  const { toast } = useToast()
  
  const { navigation, isLoading: isLoadingNav } = useNavigation()
  const { categories, isLoading: isLoadingCategories, mutate } = useCategories(navigationSlug || undefined)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const currentNav = navigation.find(nav => nav.slug === navigationSlug)

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    currentNav && { label: currentNav.title, href: `/categories?navigation=${navigationSlug}` }
  ].filter(Boolean)

  const handleRefresh = async () => {
    if (!navigationSlug) return
    setIsRefreshing(true)
    try {
      toast({
        title: "Refreshing Categories",
        description: "Scraping fresh category data from World of Books...",
      })
      await navigationAPI.scrapeCategory(navigationSlug)
      await mutate()
      toast({
        title: "Categories Refreshed",
        description: `Loaded ${categories.length} categories`,
      })
    } catch (error: any) {
      toast({
        title: "Refresh Failed",
        description: error.message || "Failed to refresh categories",
        variant: "destructive"
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleNavigationChange = (slug: string) => {
    router.push(`/categories?navigation=${slug}`)
  }

  if (!navigationSlug) {
    return (
      <div className="space-y-8">
        <div className="text-center py-16">
          <LayoutGrid className="h-16 w-16 mx-auto mb-6 text-muted-foreground opacity-50" />
          <h1 className="text-4xl font-bold mb-4">Select a Category Section</h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">
            Choose a navigation item from the homepage to explore its categories
          </p>
          <Button onClick={() => router.push('/')} size="lg">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <Breadcrumb items={breadcrumbItems} />

      <div className="flex items-start gap-8">
        {/* Sidebar - Navigation Switcher */}
        <div className="w-72 flex-shrink-0">
          <div className="sticky top-8 rounded-xl border bg-gradient-to-b from-card to-card/80 backdrop-blur-sm shadow-lg p-6 space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Browse Sections
              </h3>
            </div>
            <div className="space-y-1.5">
              {isLoadingNav ? (
                <div className="flex justify-center py-6">
                  <LoadingSpinner size="sm" />
                </div>
              ) : (
                navigation.map((nav) => (
                  <button
                    key={nav.id}
                    onClick={() => handleNavigationChange(nav.slug)}
                    className={`w-full rounded-lg px-4 py-3 text-left text-sm font-medium transition-all duration-200 ${
                      navigationSlug === nav.slug
                        ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md"
                        : "text-foreground hover:bg-accent/50 border border-transparent"
                    }`}
                  >
                    {nav.title}
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
            <div className="flex flex-col gap-6">
              <div>
                <h1 className="text-5xl font-bold tracking-tight mb-3">{currentNav?.title}</h1>
                <p className="text-lg text-muted-foreground max-w-2xl">
                  Explore {categories.length > 0 ? categories.length : ''} categories in this section
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={handleRefresh}
                  disabled={isRefreshing || isLoadingCategories}
                  size="lg"
                  className="gap-2"
                >
                  {isRefreshing || isLoadingCategories ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-5 w-5" />
                      Refresh Categories
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {(isLoadingCategories || isRefreshing) && categories.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="rounded-full bg-primary/10 p-4 mb-4">
                <LoadingSpinner size="lg" />
              </div>
              <p className="text-lg font-medium text-foreground">
                Loading categories...
              </p>
              <p className="text-muted-foreground mt-2">
                Scraping {currentNav?.title} from World of Books
              </p>
            </div>
          )}

          {/* Empty State */}
          {!isLoadingCategories && !isRefreshing && categories.length === 0 && (
            <div className="rounded-xl border border-dashed bg-card/30 p-16 text-center">
              <LayoutGrid className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-lg font-medium text-foreground mb-2">
                No categories found
              </p>
              <p className="text-muted-foreground mb-6">
                Try refreshing to fetch the latest categories
              </p>
              <Button onClick={handleRefresh} size="lg">
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Categories
              </Button>
            </div>
          )}

          {/* Categories Grid */}
          {!isLoadingCategories && !isRefreshing && categories.length > 0 && (
            <div>
              <div className="mb-6 flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {categories.length} Categor{categories.length !== 1 ? 'ies' : 'y'}
                </span>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {categories.map((category) => (
                  <CategoryCard key={category.id} category={category} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}