"use client"

import { useState } from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { useToast } from "@/lib/hooks/useToast"
import { navigationAPI } from "@/lib/api/navigation"
import { productsAPI } from "@/lib/api/products"

interface RefreshButtonProps {
  type: 'navigation' | 'category' | 'product'
  target: string
  label?: string
  onSuccess?: () => void
  className?: string
}

export function RefreshButton({ 
  type, 
  target, 
  label = "Refresh",
  onSuccess,
  className
}: RefreshButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleRefresh = async () => {
    setIsLoading(true)
    try {
      let result: any
      
      switch (type) {
        case 'navigation':
          result = await navigationAPI.scrapeNavigation()
          break
        case 'category':
          result = await navigationAPI.scrapeCategory(target)
          break
        case 'product':
          result = await productsAPI.scrapeProduct(target, true)
          break
        default:
          throw new Error(`Unknown refresh type: ${type}`)
      }
      
      toast({
        title: "Refresh successful",
        description: result.message || `${type} has been refreshed`,
      })
      
      if (onSuccess) onSuccess()
    } catch (error: any) {
      console.error('Refresh error:', error)
      toast({
        title: "Refresh failed",
        description: error.message || "Something went wrong",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRefresh}
      disabled={isLoading}
      className={className}
    >
      <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
      {isLoading ? "Refreshing..." : label}
    </Button>
  )
}