import Image from "next/image"
import { Star, Calendar, Tag, RefreshCw, ExternalLink } from "lucide-react"
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
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/*
          Product image. No fixed aspect ratio: a cover is whatever shape the publisher
          printed, and forcing a square meant object-cover cropped the author's name off
          the bottom of every tall paperback. width/height of 0 with `sizes` is the Next.js
          way of saying "I do not know the dimensions" — the browser applies the file's own
          ratio once it loads, so each book keeps its true shape.
        */}
        <div className="relative mx-auto w-full max-w-sm self-start rounded-lg border bg-white p-6 lg:mx-0">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.title}
              width={0}
              height={0}
              sizes="(max-width: 1024px) 90vw, 40vw"
              className="h-auto w-full"
              priority
            />
          ) : (
            <div className="flex aspect-[3/4] items-center justify-center text-6xl">📚</div>
          )}
          {onRefresh && (
            <div className="absolute right-2 top-2">
              <Button
                variant="secondary"
                size="icon"
                onClick={onRefresh}
                disabled={isRefreshing}
                aria-label="Refresh this book's data"
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

          {/* Rating — only when there is one. World of Books publishes none, so this is
              normally absent rather than a row of empty stars reading "0.0 (0 reviews)". */}
          {rating > 0 && (
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
          )}

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
            {/* Nothing here is for sale — buying happens on World of Books, so the primary
                action goes there rather than to a cart that never existed. */}
            {product.source_url && (
              <Button size="lg" className="flex-1 gap-2" asChild>
                <a href={product.source_url} target="_blank" rel="noopener noreferrer">
                  View on World of Books
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
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
        </div>
      </div>
    </div>
  )
}