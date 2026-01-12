    import { CategoryCard } from "./CategoryCard"
import { Category } from "@/lib/types"
import { Button } from "@/components/ui/Button"

interface CategoryGridProps {
  categories: Category[]
  title?: string
  showAll?: boolean
  limit?: number
}

export function CategoryGrid({
  categories,
  title,
  showAll = false,
  limit = 12,
}: CategoryGridProps) {
  const displayCategories = showAll ? categories : categories.slice(0, limit)

  if (!categories.length) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground">No categories found</p>
      </div>
    )
  }

  return (
    <div>
      {title && (
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">{title}</h2>
          {!showAll && categories.length > limit && (
            <Button variant="outline">View all</Button>
          )}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {displayCategories.map((category) => (
          <CategoryCard key={category.id} category={category} />
        ))}
      </div>
    </div>
  )
}