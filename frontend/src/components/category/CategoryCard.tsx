"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { FolderOpen, ArrowRight, Zap, Sparkles } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Category } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { useToast } from "@/lib/hooks/useToast"
import { navigationAPI } from "@/lib/api/navigation"

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
      // Check if interactive scraper is available
      const useInteractive = typeof window !== 'undefined' && 
        process.env.NEXT_PUBLIC_ENABLE_INTERACTIVE_SCRAPING === 'true'
      
      if (useInteractive && navigationSlug) {
        // First hover over navigation
        toast({
          title: "Starting Interactive Session",
          description: `Hovering over ${navigationSlug}...`,
        })
        
        // In a real implementation, this would trigger WebSocket hover event
        // For now, we'll simulate it
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      // Navigate to products page
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
    <Card 
      className={cn(
        "group cursor-pointer transition-all duration-300 hover:shadow-lg hover:border-primary/50 overflow-hidden",
        className
      )}
      onClick={handleCategoryClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-primary" />
            {category.title}
          </CardTitle>
          <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {category.product_count > 0 && (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              {category.product_count} product{category.product_count !== 1 ? 's' : ''}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {isLoading ? "Loading..." : "Click to browse"}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}