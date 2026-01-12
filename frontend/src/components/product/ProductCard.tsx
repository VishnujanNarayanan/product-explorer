"use client"

import Image from "next/image"
import Link from "next/link"
import { Star, ShoppingCart, RefreshCw } from "lucide-react"
import { Card, CardContent, CardFooter } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Product } from "@/lib/types"
import { cn, formatPrice, getRatingStars } from "@/lib/utils"
import { useState } from "react"
import { useToast } from "@/lib/hooks/useToast"
import { productsAPI } from "@/lib/api/products"

interface ProductCardProps {
  product: Product
  className?: string
  showCategory?: boolean
  onRefresh?: () => void
}

export function ProductCard({
  product,
  className,
  showCategory = true,
  onRefresh,
}: ProductCardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const { toast } = useToast()
  const rating = product.detail?.ratings_avg || 0
  const { full, half, empty } = getRatingStars(rating)

  const handleRefresh = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    setIsRefreshing(true)
    try {
      const result = await productsAPI.scrapeProduct(product.source_id, true)
      toast({
        title: "Refresh Started",
        description: result.message || "Product data is being refreshed",
      })
      if (onRefresh) onRefresh()
    } catch (error: any) {
      toast({
        title: "Refresh Failed",
        description: error.message || "Failed to refresh product",
        variant: "destructive"
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleViewDetails = (e: React.MouseEvent) => {
    // Navigation is handled by Link wrapper
  }

  return (
    <Card className={cn("overflow-hidden hover:shadow-md transition-shadow", className)}>
      <Link href={`/products/${product.source_id}`} className="block">
        <div className="relative aspect-square overflow-hidden bg-muted">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.title}
              fill
              className="object-cover transition-transform hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-4xl">
              📚
            </div>
          )}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full p-2 hover:bg-background transition-colors z-10"
            aria-label="Refresh product data"
            title="Refresh product data"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </Link>
      <CardContent className="p-4">
        <Link href={`/products/${product.source_id}`} className="block">
          <h3 className="font-semibold line-clamp-2 hover:text-primary transition-colors">
            {product.title}
          </h3>
        </Link>
        {showCategory && product.category && (
          <p className="mt-1 text-sm text-muted-foreground">
            {product.category.title}
          </p>
        )}
        <div className="mt-2 flex items-center gap-1">
          {Array(full).fill(0).map((_, i) => (
            <Star key={`full-${i}`} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          ))}
          {half > 0 && (
            <Star className="h-4 w-4 fill-yellow-400/50 text-yellow-400" />
          )}
          {Array(empty).fill(0).map((_, i) => (
            <Star key={`empty-${i}`} className="h-4 w-4 text-muted-foreground" />
          ))}
          <span className="ml-2 text-sm text-muted-foreground">
            ({product.detail?.reviews_count || 0})
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-lg font-bold">
            {formatPrice(product.price, product.currency)}
          </span>
          <span className="text-xs text-muted-foreground">
            {new Date(product.last_scraped_at).toLocaleDateString()}
          </span>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Button className="w-full" size="sm" asChild>
          <Link href={`/products/${product.source_id}`} onClick={handleViewDetails}>
            <ShoppingCart className="mr-2 h-4 w-4" />
            View Details
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}