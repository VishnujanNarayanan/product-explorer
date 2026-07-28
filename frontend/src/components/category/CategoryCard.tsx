"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { Category } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { useToast } from "@/lib/hooks/useToast"
import { webSocketClient } from "@/lib/api/websocket"

interface CategoryCardProps {
  category: Category
  className?: string
}

export function CategoryCard({ category, className }: CategoryCardProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const navigationSlug = searchParams.get('navigation')
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  const handleCategoryClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Open the section's menu in the live browser session before the products page asks
      // it to click this category, mirroring how a person would reach it on the site.
      if (navigationSlug && webSocketClient.isSessionReady()) {
        webSocketClient.hoverNavigation(navigationSlug, navigationSlug)
      }

      router.push(`/products?category=${category.slug}&navigation=${navigationSlug}`)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load products",
        variant: "destructive"
      })
      setIsLoading(false)
    }
  }

  return (
    <a
      href={`/products?category=${category.slug}&navigation=${navigationSlug}`}
      onClick={handleCategoryClick}
      className={cn(
        "group flex items-center justify-between gap-4 rounded-lg border border-l-2 border-l-transparent bg-card p-5 transition-colors hover:border-l-highlight hover:bg-secondary/50",
        className,
      )}
    >
      <span className="min-w-0">
        <span className="block truncate font-medium">{category.title}</span>
        <span className="mt-1 block font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground">
          {isLoading
            ? 'opening…'
            : category.product_count > 0
              ? `${category.product_count} stored`
              : 'not scraped yet'}
        </span>
      </span>
      <ArrowRight className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </a>
  )
}
