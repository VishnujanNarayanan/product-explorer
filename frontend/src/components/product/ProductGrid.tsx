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
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-80 animate-pulse rounded-lg bg-muted" />
        ))}
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
        <h2 className="mb-6 text-2xl font-bold">{title}</h2>
      )}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      {showLoadMore && hasMore && (
        <div className="mt-8 text-center">
          <Button onClick={onLoadMore} disabled={isLoading}>
            {isLoading ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}
    </div>
  )
}