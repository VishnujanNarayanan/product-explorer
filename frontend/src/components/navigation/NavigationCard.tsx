import Link from "next/link"
import { ArrowRight, BookOpen, ChevronDown, Sparkles } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Navigation } from "@/lib/types"
import { useState } from "react"

interface NavigationCardProps {
  navigation: Navigation
  className?: string
}

// Items with categories (5 items as per requirement)
const ITEMS_WITH_CATEGORIES = [
  "fiction-books",
  "non-fiction-books", 
  "childrens-books",
  "rare-books",
  "music-film"
]

export function NavigationCard({ navigation, className }: NavigationCardProps) {
  const [showCategories, setShowCategories] = useState(false)
  const hasCategories = ITEMS_WITH_CATEGORIES.includes(navigation.slug)

  return (
    <Card 
      className={`${className} transition-all duration-300 hover:shadow-2xl hover:border-primary/50 group bg-gradient-to-br from-card via-card to-card/80 border-primary/5`}
      onMouseEnter={() => hasCategories && setShowCategories(true)}
      onMouseLeave={() => setShowCategories(false)}
    >
      <CardHeader className="pb-4 relative">
        <div className="flex items-start justify-between">
          <CardTitle className="flex items-center gap-3 text-lg">
            <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <span className="group-hover:text-primary transition-colors">{navigation.title}</span>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Explore {navigation.title.toLowerCase()} collection
        </p>

        {/* Categories Dropdown - Shows on hover for items with categories */}
        {hasCategories && (
          <div className="border-t pt-4 space-y-2">
            <button
              onClick={() => setShowCategories(!showCategories)}
              className="flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors w-full"
            >
              <Sparkles className="h-4 w-4" />
              <span>View Categories</span>
              <ChevronDown 
                className={`h-4 w-4 ml-auto transition-transform ${showCategories ? 'rotate-180' : ''}`}
              />
            </button>

            {showCategories && navigation.categories && (
              <div className="space-y-2 max-h-48 overflow-y-auto animate-in fade-in">
                {navigation.categories.slice(0, 5).map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors border border-primary/10"
                  >
                    <span className="truncate font-medium text-foreground">{category.title}</span>
                    <span className="text-primary font-semibold ml-2 flex-shrink-0">
                      {category.product_count || '—'}
                    </span>
                  </div>
                ))}
                {(navigation.categories?.length || 0) > 5 && (
                  <p className="text-xs text-muted-foreground text-center py-1">
                    +{(navigation.categories?.length || 0) - 5} more
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <Link href={`/categories?navigation=${navigation.slug}`} className="block pt-2">
          <Button variant="outline" className="w-full group/btn hover:bg-primary hover:text-primary-foreground transition-all">
            Explore All
            <ArrowRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}