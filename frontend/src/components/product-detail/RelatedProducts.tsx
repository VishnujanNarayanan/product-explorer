"use client"

import React, { useState, useEffect } from "react"
import { ProductCard } from "@/components/product/ProductCard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Product } from "@/lib/types"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import { Button } from "@/components/ui/Button"
import { RefreshCw } from "lucide-react"
import { productsAPI } from "@/lib/api/products"

interface RelatedProductsProps {
  productId: string
  limit?: number
}

export function RelatedProducts({ productId, limit = 4 }: RelatedProductsProps) {
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([])
  const [isLoadingRelated, setIsLoadingRelated] = useState(false)
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null)

  useEffect(() => {
    loadRelatedProducts()
  }, [productId])

  const loadRelatedProducts = async () => {
    if (!productId) return
    setIsLoadingRelated(true)
    try {
      // Get current product first to know its category
      const productResponse = await productsAPI.getProduct(productId)
      setCurrentProduct(productResponse)
      
      if (productResponse && productResponse.category) {
        // Get products from same category (excluding current product)
        const categoryProducts = await productsAPI.getProductsByCategory(productResponse.category.slug)
        const filtered = (categoryProducts.products || [])
          .filter(p => p.source_id !== productId)
          .slice(0, limit)
        setRelatedProducts(filtered)
      } else {
        // Fallback: get some random products
        const allProducts = await productsAPI.getAllProducts()
        const randomProducts = Array.isArray(allProducts) 
          ? allProducts
              .filter(p => p.source_id !== productId)
              .sort(() => Math.random() - 0.5)
              .slice(0, limit)
          : []
        setRelatedProducts(randomProducts)
      }
    } catch (error) {
      console.error("Failed to load related products:", error)
      setRelatedProducts([])
    } finally {
      setIsLoadingRelated(false)
    }
  }

  if (isLoadingRelated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Related Products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!relatedProducts.length) {
    return null
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Related Products</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={loadRelatedProducts}
          disabled={isLoadingRelated}
        >
          <RefreshCw className={`mr-2 h-3 w-3 ${isLoadingRelated ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          {relatedProducts.map((relatedProduct) => (
            <ProductCard
              key={relatedProduct.id}
              product={relatedProduct}
              className="h-full"
              showCategory={true}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}