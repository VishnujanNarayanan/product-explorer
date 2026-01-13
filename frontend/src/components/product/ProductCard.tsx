"use client"

import Image from "next/image"
import Link from "next/link"
import { Star, RefreshCw, ArrowRight, ImageOff } from "lucide-react"
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

  return (
    <Card className={cn("overflow-hidden hover:shadow-xl transition-all hover:border-primary/50 group", className)}>
      <Link href={`/products/${product.source_id}`} className="block">
        <div className="relative aspect-square overflow-hidden bg-muted">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.title}
              fill
              className="object-cover transition-transform group-hover:scale-110 duration-300"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
              onError={(e) => {
                // Fallback on image load error
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : null}
          {!product.image_url && (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/10 via-primary/5 to-muted">
              <div className="flex flex-col items-center gap-2 opacity-60">
                <ImageOff className="h-8 w-8" />
                <span className="text-xs text-muted-foreground text-center px-4">
                  No image available
                </span>
              </div>
            </div>
          )}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="absolute top-2 right-2 bg-background/90 backdrop-blur-md rounded-full p-2 hover:bg-background transition-all z-10 shadow-lg opacity-0 group-hover:opacity-100"
            aria-label="Refresh product data"
            title="Refresh product data"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </Link>
      <CardContent className="p-4">
        <Link href={`/products/${product.source_id}`} className="block group/title">
          <h3 className="font-semibold line-clamp-2 group-hover/title:text-primary transition-colors text-sm">
            {product.title}
          </h3>
        </Link>
        {showCategory && product.category && (
          <p className="mt-1 text-xs text-muted-foreground">
            in {product.category.title}
          </p>
        )}
        
        {/* Rating */}
        {rating > 0 && (
          <div className="mt-2 flex items-center gap-1">
            <div className="flex gap-0.5">
              {Array(full).fill(0).map((_, i) => (
                <Star key={`full-${i}`} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              ))}
              {half > 0 && (
                <div className="relative h-3 w-3">
                  <Star className="h-3 w-3 text-yellow-400" />
                  <div className="absolute top-0 left-0 overflow-hidden w-1.5 h-3">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  </div>
                </div>
              )}
              {Array(empty).fill(0).map((_, i) => (
                <Star key={`empty-${i}`} className="h-3 w-3 text-muted-foreground/30" />
              ))}
            </div>
            <span className="text-xs text-muted-foreground ml-1">
              {rating.toFixed(1)}
            </span>
          </div>
        )}

        {/* Price */}
        {product.price && (
          <div className="mt-3 pt-3 border-t">
            <p className="font-bold text-lg text-primary">
              £{product.price}
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Link href={`/products/${product.source_id}`} className="w-full">
          <Button variant="outline" className="w-full group/btn">
            View Details
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  )
}