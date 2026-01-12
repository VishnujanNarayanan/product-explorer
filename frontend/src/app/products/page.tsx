"use client"

import { useState, useEffect } from "react"
import { ProductGrid } from "@/components/product/ProductGrid"
import { ProductFilters } from "@/components/product/ProductFilters"
import { Breadcrumb } from "@/components/shared/Breadcrumb"
import { useProducts } from "@/lib/hooks/useProducts"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"

export default function ProductsPage() {
  const [filters, setFilters] = useState({})
  const { products, isLoading, loadProducts } = useProducts(undefined, filters)

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Products", href: "/products" },
  ]

  return (
    <div className="space-y-8">
      <div>
        <Breadcrumb items={breadcrumbItems} />
        <div className="mt-4">
          <h1 className="text-3xl font-bold">All Products</h1>
          <p className="mt-2 text-muted-foreground">
            Browse all available books
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-4">
        {/* Filters Sidebar */}
        <div className="lg:col-span-1">
          <ProductFilters onFilterChange={setFilters} />
        </div>

        {/* Products Grid */}
        <div className="lg:col-span-3">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <ProductGrid
              products={products}
              title={`${products.length} Products`}
              isLoading={isLoading}
            />
          )}
        </div>
      </div>
    </div>
  )
}