"use client"

import { useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { CategoryCard } from "@/components/category/CategoryCard"
import { useCategories } from "@/lib/hooks/useCategories"
import { useNavigation } from "@/lib/hooks/useNavigation"
import { Breadcrumb } from "@/components/shared/Breadcrumb"
import { SideRail } from "@/components/layout/SideRail"
import { navigationAPI } from "@/lib/api/navigation"
import { useToast } from "@/lib/hooks/useToast"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import { Button } from "@/components/ui/Button"
import { RefreshCw, ArrowLeft, Loader2, LayoutGrid } from "lucide-react"

function CategoriesPageContent() {
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
      <div className="container space-y-8 py-10">
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
    <div className="container space-y-8 py-10">
      <Breadcrumb items={breadcrumbItems} />

      <div className="flex flex-col items-start gap-10 lg:flex-row">
        <SideRail
          label="Sections"
          isLoading={isLoadingNav}
          items={navigation.map((nav) => ({
            id: nav.id,
            title: nav.title,
            count: nav.categories?.length,
            isActive: navigationSlug === nav.slug,
          }))}
          onSelect={(item) => {
            const nav = navigation.find((n) => n.id === item.id)
            if (nav) handleNavigationChange(nav.slug)
          }}
        />

        {/* Main Content */}
        <div className="min-w-0 flex-1">
          {/* Header */}
          <div className="mb-10 border-b pb-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="label-meta">Section</p>
                <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">
                  {currentNav?.title}
                </h1>
                <p className="mt-3 text-sm text-muted-foreground">
                  {categories.length > 0
                    ? `${categories.length} categories · pick one to scrape its books`
                    : 'No categories stored for this section yet'}
                </p>
              </div>
              <Button
                onClick={handleRefresh}
                disabled={isRefreshing || isLoadingCategories}
                variant="outline"
                className="gap-2 self-start lg:self-auto"
              >
                {isRefreshing || isLoadingCategories ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Re-scrape categories
              </Button>
            </div>
          </div>

          {/* Loading State */}
          {(isLoadingCategories || isRefreshing) && categories.length === 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="space-y-3 rounded-lg border p-5">
                  <div className="skeleton h-5 w-2/3" />
                  <div className="skeleton h-3 w-1/3" />
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoadingCategories && !isRefreshing && categories.length === 0 && (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <p className="font-medium">Nothing stored for this section</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Re-scraping asks World of Books for this section&apos;s categories again.
              </p>
              <Button onClick={handleRefresh} className="mt-6" variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Re-scrape categories
              </Button>
            </div>
          )}

          {/* Categories Grid */}
          {!isLoadingCategories && !isRefreshing && categories.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {categories.map((category) => (
                <CategoryCard key={category.id} category={category} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CategoriesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <CategoriesPageContent />
    </Suspense>
  )
}