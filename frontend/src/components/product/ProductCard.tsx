"use client"

import Image from "next/image"
import Link from "next/link"
import { RefreshCw, ImageOff, ExternalLink } from "lucide-react"
import { Product } from "@/lib/types"
import { cn } from "@/lib/utils"
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
    // The title link is stretched over the whole tile, so the card is one target without
    // nesting a button inside an anchor.
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:border-foreground/25",
        className,
      )}
    >
      <div className="relative aspect-[3/4] bg-white p-4 dark:bg-secondary">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.title}
            fill
            // Covers arrive at whatever proportion the publisher printed. Contain keeps
            // every one whole rather than cropping the title off a tall paperback.
            className="object-contain p-3 transition-transform duration-300 group-hover:scale-[1.03]"
            sizes="(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 16vw"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageOff className="h-6 w-6" />
            <span className="px-4 text-center text-xs">No image available</span>
          </div>
        )}

        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="absolute right-2 top-2 z-20 rounded-full border bg-background/90 p-2 opacity-0 shadow-rise backdrop-blur transition-opacity hover:bg-background focus-visible:opacity-100 group-hover:opacity-100"
          aria-label="Refresh product data"
          title="Refresh product data"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
        </button>
      </div>

      <div className="flex flex-1 flex-col border-t p-4">
        <h3 className="text-sm font-medium leading-snug">
          <Link
            href={`/products/${product.source_id}`}
            className="line-clamp-2 after:absolute after:inset-0 hover:underline"
          >
            {product.title}
          </Link>
        </h3>

        {/* The assignment lists author among the required product-tile fields. */}
        {product.author && (
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">by {product.author}</p>
        )}

        {showCategory && product.category && (
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
            in {product.category.title}
          </p>
        )}

        {product.price && (
          <p className="mt-auto pt-3 font-mono text-sm font-medium text-highlight">
            £{product.price}
          </p>
        )}

        {/* Always reachable at the source, whether or not we hold a detail row for it — a book
            scraped into the grid a moment ago has somewhere to go before anyone has stored it.
            z-20 lifts it above the title's full-card overlay link, which would swallow the
            click otherwise. */}
        {product.source_url && (
          <a
            href={product.source_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="relative z-20 mt-3 inline-flex items-center gap-1.5 self-start border-b border-transparent text-xs text-muted-foreground transition-colors hover:border-current hover:text-foreground"
          >
            Buy on World of Books
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        )}
      </div>
    </article>
  )
}
