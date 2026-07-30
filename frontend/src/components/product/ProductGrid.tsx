import { ProductCard } from "./ProductCard"
import { Product } from "@/lib/types"
import { Button } from "@/components/ui/Button"

interface ProductGridProps {
  products: Product[]
  title?: string
  isLoading?: boolean
  showLoadMore?: boolean
  onLoadMore?: () => void
  hasMore?: boolean
}

export function ProductGrid({
  products,
  title,
  isLoading = false,
  showLoadMore = false,
  onLoadMore,
  hasMore = false,
}: ProductGridProps) {
  if (isLoading && !products.length) {
    return (
      <div className="space-y-6">
        {title && (
          <h2 className="text-2xl font-bold">{title}</h2>
        )}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 xl:grid-cols-4 2xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-lg border">
              <div className="skeleton aspect-[3/4] rounded-none" />
              <div className="space-y-2 border-t p-4">
                <div className="skeleton h-4" />
                <div className="skeleton h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!products.length) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground">No products found</p>
      </div>
    )
  }

  return (
    <div>
      {title && (
        <h2 className="mb-6 font-display text-2xl font-semibold">{title}</h2>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 xl:grid-cols-4 2xl:grid-cols-5">
        {products.map((product, index) => (
          // Live results arrive from the scraper before they have a database id, and the
          // same source_id legitimately appears under two categories, so neither field is
          // a key on its own.
          <ProductCard
            key={`${product.category?.id ?? 'live'}-${product.source_id ?? product.id ?? index}`}
            product={product}
          />
        ))}
      </div>
      {showLoadMore && hasMore && (
        <div className="mt-8 flex justify-center">
          <Button onClick={onLoadMore} size="lg" variant="outline">
            Load More Products
          </Button>
        </div>
      )}
    </div>
  )
}