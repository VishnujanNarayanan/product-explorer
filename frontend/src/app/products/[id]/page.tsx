"use client"

import { notFound } from "next/navigation"
import { useParams } from "next/navigation"
import { ProductHeader } from "@/components/product-detail/ProductHeader"
import { ProductDescription } from "@/components/product-detail/ProductDescription"
import { ProductReviews } from "@/components/product-detail/ProductReviews"
import { RelatedProducts } from "@/components/product-detail/RelatedProducts"
import { Breadcrumb } from "@/components/shared/Breadcrumb"
import { useProductDetail } from "@/lib/hooks/useProductDetail"
import { useToast } from "@/lib/hooks/useToast"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import { ErrorBoundary } from "@/components/ui/ErrorBoundary"
import { productsAPI } from "@/lib/api/products"
import { useState, useEffect } from "react"

export default function ProductDetailPage() {
  const params = useParams()
  const sourceId = params.id as string
  const { toast } = useToast()
  const [product, setProduct] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  useEffect(() => {
    loadProduct()
  }, [sourceId])

  const loadProduct = async () => {
    setIsLoading(true)
    try {
      const productData = await productsAPI.getProduct(sourceId)
      setProduct(productData)
    } catch (error) {
      console.error('Failed to load product:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!product) {
    notFound()
  }

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Products", href: "/products" },
  ]

  if (product.category) {
    breadcrumbItems.push({
      label: product.category.title,
      href: `/products?category=${product.category.slug}`,
    })
  }

  breadcrumbItems.push({
    label: product.title,
    href: `/products/${product.source_id}`,
  })

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      const result = await productsAPI.scrapeProduct(sourceId, true)
      setProduct(result.data || product)
      toast({
        title: "Success",
        description: result.message || "Product data refreshed successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to refresh product data",
        variant: "destructive",
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <ErrorBoundary>
      <div className="space-y-8">
        <Breadcrumb items={breadcrumbItems} />

        <ProductHeader
          product={product}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">
            <ProductDescription product={product} />
            {product.detail && (
              <ProductReviews
                reviews={product.reviews || []}
                averageRating={product.detail.ratings_avg || 0}
                totalReviews={product.detail.reviews_count || 0}
              />
            )}
          </div>

          <div>
            <RelatedProducts productId={sourceId} />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}