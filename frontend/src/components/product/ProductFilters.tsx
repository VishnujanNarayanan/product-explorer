"use client"

import { useState } from "react"
import { Filter, X } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { ProductFilters as ProductFiltersType } from "@/lib/types"
import { cn } from "@/lib/utils"

interface ProductFiltersProps {
  onFilterChange: (filters: ProductFiltersType) => void
  className?: string
}

export function ProductFilters({ onFilterChange, className }: ProductFiltersProps) {
  const [filters, setFilters] = useState<ProductFiltersType>({})
  const [isOpen, setIsOpen] = useState(false)

  const handleFilterChange = (key: keyof ProductFiltersType, value: any) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const handleReset = () => {
    setFilters({})
    onFilterChange({})
  }

  const hasActiveFilters = Object.values(filters).some(
    (value) => value !== undefined && value !== ""
  )

  return (
    <div className={className}>
      {/* Mobile filter button */}
      <Button
        variant="outline"
        className="md:hidden w-full mb-4"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Filter className="mr-2 h-4 w-4" />
        Filters
        {hasActiveFilters && (
          <span className="ml-2 rounded-full bg-primary px-2 py-1 text-xs text-primary-foreground">
            {Object.keys(filters).length}
          </span>
        )}
      </Button>

      {/* Filter panel */}
      <div className={cn(
        "md:block",
        isOpen ? "block" : "hidden"
      )}>
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Filters</h3>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="h-auto p-0 text-sm"
              >
                <X className="mr-1 h-3 w-3" />
                Clear
              </Button>
            )}
          </div>

          <div className="space-y-4">
            {/* Price Range */}
            <div>
              <label className="mb-2 block text-sm font-medium">Price Range</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={filters.minPrice || ""}
                  onChange={(e) =>
                    handleFilterChange("minPrice", e.target.value ? Number(e.target.value) : undefined)
                  }
                  className="text-sm"
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={filters.maxPrice || ""}
                  onChange={(e) =>
                    handleFilterChange("maxPrice", e.target.value ? Number(e.target.value) : undefined)
                  }
                  className="text-sm"
                />
              </div>
            </div>

            {/* Rating */}
            <div>
              <label className="mb-2 block text-sm font-medium">Minimum Rating</label>
              <div className="flex gap-2">
                {[4, 3, 2, 1].map((rating) => (
                  <Button
                    key={rating}
                    type="button"
                    variant={filters.minRating === rating ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() =>
                      handleFilterChange("minRating", filters.minRating === rating ? undefined : rating)
                    }
                  >
                    {rating}+ ★
                  </Button>
                ))}
              </div>
            </div>

            {/* Sort By */}
            <div>
              <label className="mb-2 block text-sm font-medium">Sort By</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={filters.sortBy || ""}
                onChange={(e) =>
                  handleFilterChange("sortBy", e.target.value || undefined)
                }
              >
                <option value="">Default</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
                <option value="newest">Newest</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}