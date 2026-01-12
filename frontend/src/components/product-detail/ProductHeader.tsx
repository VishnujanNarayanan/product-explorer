import Image from "next/image"
import { Star, Calendar, Tag, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Product } from "@/lib/types"
import { formatPrice, getRatingStars, formatDate } from "@/lib/utils"
import { useToast } from "@/lib/hooks/useToast"

interface ProductHeaderProps {
  product: Product
  onRefresh?: () => void
  isRefreshing?: boolean
}

export function ProductHeader({ 
  product, 
  onRefresh, 
  isRefreshing = false 
}: ProductHeaderProps) {
  const { toast } = useToast()
  const rating = product.detail?.ratings_avg || 0
  const { full, half, empty } = getRatingStars(rating)
  const reviewsCount = product.detail?.reviews_count || 0

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: product.title,
          text: `Check out ${product.title} on World of Books Explorer`,
          url: window.location.href,
        })
      } else {
        await navigator.clipboard.writeText(window.location.href)
        toast({
          title: "Link copied!",
          description: "Product link copied to clipboard.",
        })
      }
    } catch (error) {
      console.error("Error sharing:", error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Home</span>
        <span>/</span>
        {product.category && (
          <>
            <span>{product.category.title}</span>
            <span>/</span>
          </>
        )}
        <span className="font-medium text-foreground">{product.title}</span>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Product Image */}
        <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.title}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-6xl">
              📚
            </div>
          )}
          {onRefresh && (
            <div className="absolute right-2 top-2">
              <Button
                variant="secondary"
                size="icon"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="h-9 w-9 bg-background/80 backdrop-blur-sm"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </Button>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">{product.title}</h1>
            {product.category && (
              <div className="mt-2 flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {product.category.title}
                </span>
              </div>
            )}
          </div>

          {/* Rating */}
          <div className="flex items-center gap-2">
            <div className="flex">
              {Array(full).fill(0).map((_, i) => (
                <Star key={`full-${i}`} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
              ))}
              {half > 0 && (
                <Star className="h-5 w-5 fill-yellow-400/50 text-yellow-400" />
              )}
              {Array(empty).fill(0).map((_, i) => (
                <Star key={`empty-${i}`} className="h-5 w-5 text-muted-foreground" />
              ))}
            </div>
            <span className="text-lg font-semibold">{rating.toFixed(1)}</span>
            <span className="text-muted-foreground">
              ({reviewsCount} review{reviewsCount !== 1 ? 's' : ''})
            </span>
          </div>

          {/* Price */}
          <div className="space-y-2">
            <div className="text-4xl font-bold">
              {formatPrice(product.price, product.currency)}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Last updated: {formatDate(product.last_scraped_at)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" className="flex-1">
              Add to Cart
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="flex-1"
              onClick={handleShare}
            >
              Share
            </Button>
            {onRefresh && (
              <Button
                size="lg"
                variant="secondary"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="sm:w-auto"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                {isRefreshing ? "Refreshing..." : "Refresh Data"}
              </Button>
            )}
          </div>

          {/* Source Link */}
          {product.source_url && (
            <div className="pt-4 border-t">
              <a
                href={product.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                View on World of Books →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}