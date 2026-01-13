// frontend/src/components/shared/ScrapeAgainButton.tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { useToast } from "@/lib/hooks/useToast"
import { RefreshCw, Sparkles, Loader2, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface ScrapeAgainButtonProps {
  categorySlug: string
  categoryTitle: string
  navigationSlug?: string
  onScrapeComplete?: (products: any[]) => void
  className?: string
  variant?: "default" | "outline" | "secondary" | "destructive"
  size?: "default" | "sm" | "lg" | "icon"
  disabled?: boolean
}

export function ScrapeAgainButton({
  categorySlug,
  categoryTitle,
  navigationSlug,
  onScrapeComplete,
  className,
  variant = "default",
  size = "default",
  disabled = false,
}: ScrapeAgainButtonProps) {
  const { toast } = useToast()
  const [isScraping, setIsScraping] = useState(false)
  const [lastScraped, setLastScraped] = useState<Date | null>(null)

  const handleScrapeAgain = async () => {
    if (isScraping) return
    
    setIsScraping(true)
    
    try {
      toast({
        title: "Starting Fresh Scrape",
        description: `Scraping latest products from ${categoryTitle}...`,
      })

      // In a real implementation, this would call your WebSocket or API
      // For now, simulate with timeout
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      setLastScraped(new Date())
      
      toast({
        title: "Scrape Complete!",
        description: "Fresh data loaded from World of Books",
        variant: "default",
      })
      
      if (onScrapeComplete) {
        // This would be real products from your API
        onScrapeComplete([])
      }
      
    } catch (error: any) {
      toast({
        title: "Scrape Failed",
        description: error.message || "Failed to scrape fresh data",
        variant: "destructive",
      })
    } finally {
      setIsScraping(false)
    }
  }

  const formatTimeSince = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return "just now"
    if (diffMins < 60) return `${diffMins}m ago`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleScrapeAgain}
        disabled={isScraping || disabled}
        variant={variant}
        size={size}
        className={cn("gap-2", className)}
      >
        {isScraping ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Scraping...
          </>
        ) : lastScraped ? (
          <>
            <RefreshCw className="h-4 w-4" />
            Scrape Again
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Scrape Fresh Data
          </>
        )}
      </Button>
      
      {lastScraped && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <CheckCircle className="h-3 w-3 text-green-500" />
          <span>Scraped {formatTimeSince(lastScraped)}</span>
        </div>
      )}
    </div>
  )
}