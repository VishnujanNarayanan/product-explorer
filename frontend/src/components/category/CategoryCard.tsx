    import Link from "next/link"
import { FolderOpen } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Category } from "@/lib/types"
import { cn } from "@/lib/utils"

interface CategoryCardProps {
  category: Category
  className?: string
}

export function CategoryCard({ category, className }: CategoryCardProps) {
  return (
    <Link href={`/products?category=${category.slug}`}>
      <Card
        className={cn(
          "transition-all hover:shadow-md hover:border-primary/20",
          className
        )}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{category.title}</CardTitle>
            <FolderOpen className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            {category.product_count} products available
          </p>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Last updated:{" "}
              {new Date(category.last_scraped_at).toLocaleDateString()}
            </span>
            <span>→</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}