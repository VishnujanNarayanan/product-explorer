"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { CategoryGrid } from "@/components/category/CategoryGrid"
import { ProductGrid } from "@/components/product/ProductGrid"
import { ProductFilters } from "@/components/product/ProductFilters"
import { useCategories } from "@/lib/hooks/useCategories"
import { Breadcrumb } from "@/components/shared/Breadcrumb"
import { RefreshButton } from "@/components/shared/RefreshButton"
import { navigationAPI } from "@/lib/api/navigation"
import { useToast } from "@/lib/hooks/useToast"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import { Button } from "@/components/ui/Button"
import { RefreshCw } from "lucide-react"

export default function CategoriesPage() {
  const searchParams = useSearchParams()
  const navigationSlug = searchParams.get('navigation')
  const { toast } = useToast()
  
  const { categories, isLoading: isLoadingCategories, refreshCategory, mutate } = useCategories(navigationSlug || undefined)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [filters, setFilters] = useState({})
  const [categoryProducts, setCategoryProducts] = useState<any[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  // Load products when category is selected
  useEffect(() => {
    if (selectedCategory) {
      loadCategoryProducts(selectedCategory)
    }
  }, [selectedCategory])

  const loadCategoryProducts = async (slug: string) => {
    if (!slug) return
    setLoadingProducts(true)
    try {
      // This endpoint triggers scraping if needed
      const response = await navigationAPI.getCategoryProducts(slug)
      setCategoryProducts(response.products || [])
      
      if (response.jobQueued) {
        toast({
          title: "Scraping Started!",
          description: "Products are being scraped in the background. Check back in a moment!",
        })
        
        // Poll for updates after 10 seconds
        setTimeout(() => {
          if (selectedCategory === slug) {
            loadCategoryProducts(slug)
          }
        }, 10000)
      }
    } catch (error: any) {
      toast({
        title: "Error Loading Products",
        description: error.message || "Failed to load products for this category",
        variant: "destructive"
      })
    } finally {
      setLoadingProducts(false)
    }
  }

  const handleCategoryClick = (slug: string) => {
    const newSelected = selectedCategory === slug ? null : slug
    setSelectedCategory(newSelected)
  }

  const handleRefreshCategory = async (slug: string) => {
    try {
      toast({
        title: "Refreshing Category",
        description: "Starting category refresh...",
      })
      
      // Trigger category scrape
      await navigationAPI.scrapeCategory(slug)
      
      toast({
        title: "Category Refresh Started",
        description: "Products are being scraped. This may take a moment.",
      })
      
      // Refresh categories list
      mutate()
      
      // If this category is selected, reload its products
      if (selectedCategory === slug) {
        setTimeout(() => loadCategoryProducts(slug), 3000)
      }
    } catch (error: any) {
      toast({
        title: "Refresh Failed",
        description: error.message || "Failed to refresh category",
        variant: "destructive"
      })
    }
  }

  const handleRefreshAll = async () => {
    try {
      toast({
        title: "Refreshing All",
        description: "Starting navigation refresh...",
      })
      
      await navigationAPI.scrapeNavigation()
      
      toast({
        title: "Refresh Started",
        description: "All navigation and categories are being refreshed.",
      })
      
      // Refresh categories
      mutate()
      
    } catch (error: any) {
      toast({
        title: "Refresh Failed",
        description: error.message || "Failed to refresh navigation",
        variant: "destructive"
      })
    }
  }

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Categories", href: "/categories" },
  ]

  if (navigationSlug && categories.length > 0) {
    const navCategory = categories.find(c => c.navigation?.slug === navigationSlug)
    if (navCategory) {
      breadcrumbItems.push({ 
        label: navCategory.navigation!.title, 
        href: `/categories?navigation=${navigationSlug}` 
      })
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <Breadcrumb items={breadcrumbItems} />
        <div className="mt-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Categories</h1>
            <p className="mt-2 text-muted-foreground">
              Browse books by category {navigationSlug && `in ${navigationSlug}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshAll}
              disabled={isLoadingCategories}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingCategories ? "animate-spin" : ""}`} />
              Refresh All
            </Button>
            {selectedCategory && (
              <RefreshButton 
                type="category" 
                target={selectedCategory}
                label="Refresh Category"
                onSuccess={() => handleRefreshCategory(selectedCategory)}
              />
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-4">
        {/* Filters Sidebar */}
        <div className="lg:col-span-1">
          <ProductFilters onFilterChange={setFilters} />
          
          {/* Categories List */}
          <div className="mt-6 rounded-lg border bg-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">All Categories</h3>
              <span className="text-sm text-muted-foreground">
                {categories.length} total
              </span>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {isLoadingCategories ? (
                <div className="text-center py-4">
                  <LoadingSpinner size="sm" />
                </div>
              ) : categories.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  No categories found. Try refreshing.
                </div>
              ) : (
                categories.map((category) => (
                  <div key={category.id} className="flex items-center gap-2">
                    <button
                      onClick={() => handleCategoryClick(category.slug)}
                      className={`flex-1 rounded px-3 py-2 text-left text-sm transition-colors ${
                        selectedCategory === category.slug
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-accent"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate">{category.title}</span>
                        <span className="text-xs opacity-75">
                          {category.product_count}
                        </span>
                      </div>
                    </button>
                    <RefreshButton
                      type="category"
                      target={category.slug}
                      label=""
                      className="h-8 w-8 p-0"
                      onSuccess={() => handleRefreshCategory(category.slug)}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {selectedCategory ? (
            <>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">
                    Products in {categories.find(c => c.slug === selectedCategory)?.title}
                  </h2>
                  <p className="text-muted-foreground">
                    {categoryProducts.length > 0 
                      ? `Showing ${categoryProducts.length} products`
                      : "No products found. Click refresh to scrape."
                    }
                  </p>
                </div>
                <div className="flex gap-2">
                  <RefreshButton 
                    type="category" 
                    target={selectedCategory}
                    label="Scrape Products"
                    onSuccess={() => loadCategoryProducts(selectedCategory)}
                  />
                </div>
              </div>
              {loadingProducts ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <LoadingSpinner size="lg" />
                  <p className="mt-4 text-muted-foreground">
                    Loading products...
                  </p>
                </div>
              ) : (
                <ProductGrid
                  products={categoryProducts}
                  isLoading={loadingProducts}
                  showLoadMore={false}
                />
              )}
            </>
          ) : (
            <div>
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold">All Categories</h2>
                <span className="text-sm text-muted-foreground">
                  Select a category to view products
                </span>
              </div>
              <CategoryGrid 
                categories={categories} 
                title=""
                showAll
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}