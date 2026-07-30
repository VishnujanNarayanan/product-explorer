// frontend/src/components/shared/ScrapeAgainButton.tsx
"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/Button"
import { useToast } from "@/lib/hooks/useToast"
import { webSocketClient } from "@/lib/api/websocket"
import { navigationAPI } from "@/lib/api/navigation"
import { useBrowserScrape } from "@/lib/hooks/useBrowserScrape"
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
  const [isRequesting, setIsRequesting] = useState(false)
  const [lastScraped, setLastScraped] = useState<Date | null>(null)
  const {
    scrape: browserScrape,
    isScraping: isBrowserScraping,
    message: browserScrapeMessage,
    step: browserScrapeStep,
  } = useBrowserScrape()

  const isScraping = isRequesting || isBrowserScraping

  // The hook reports what happened; this turns its final state into one honest sentence
  // instead of a fixed title over a contradicting description.
  useEffect(() => {
    if (browserScrapeStep === 'done') {
      toast({ title: "Scrape complete", description: browserScrapeMessage })
    } else if (browserScrapeStep === 'failed') {
      toast({
        title: "Scrape failed",
        description: browserScrapeMessage,
        variant: "destructive",
      })
    }
  }, [browserScrapeStep, browserScrapeMessage, toast])

  const handleScrapeAgain = async () => {
    if (isScraping) return

    setIsRequesting(true)

    try {
      // Live session first: this is the same path a category click takes, so results arrive
      // as DATA_CHUNK and the page updates itself. Progress is reported there, not here.
      if (webSocketClient.isSessionReady()) {
        webSocketClient.clickCategory(categoryTitle || categorySlug, categorySlug, navigationSlug)
        setLastScraped(new Date())
        toast({
          title: "Scraping World of Books",
          description: `Opening ${categoryTitle} in the live session — products will appear as they arrive.`,
        })
        return
      }

      // No live session, so scrape from this browser. World of Books answers the API's
      // datacentre address with 429 while serving a visitor's browser normally, which makes
      // this the path that actually reaches the storefront in production.
      toast({
        title: "Scraping World of Books",
        description: `Fetching more books from ${categoryTitle} in your browser…`,
      })

      const scraped = await browserScrape(categorySlug, {
        categoryTitle,
        navigationSlug,
        nextPage: true,
      })
      setLastScraped(new Date())

      if (scraped.length > 0) {
        onScrapeComplete?.(scraped)
        return
      }

      // Nothing came back. Either the collection has ended or this browser was refused —
      // the hook knows which, and either way the previous wording ("Scrape Queued" over a
      // message saying the category was complete) told the visitor two different things.
      const response = await navigationAPI.getCategoryProducts(categorySlug, navigationSlug)
      onScrapeComplete?.(response.products || [])

    } catch (error: any) {
      toast({
        title: "Scrape Failed",
        description: error.message || "Failed to scrape fresh data",
        variant: "destructive",
      })
    } finally {
      setIsRequesting(false)
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
            Scraping…
          </>
        ) : lastScraped ? (
          <>
            <RefreshCw className="h-4 w-4" />
            Scrape again
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Scrape this category
          </>
        )}
      </Button>
      
      {lastScraped && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <CheckCircle className="h-3 w-3 text-green-500" />
          {/* "Requested", not "Scraped": the scrape continues after the click returns. */}
          <span>Requested {formatTimeSince(lastScraped)}</span>
        </div>
      )}
    </div>
  )
}