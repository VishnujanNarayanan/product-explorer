"use client"

import { useState } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { useDebounce } from "@/lib/hooks/useDebounce"
import { useToast } from "@/lib/hooks/useToast"

interface SearchBarProps {
  className?: string
  onSearch?: (query: string) => void
}

export function SearchBar({ className, onSearch }: SearchBarProps) {
  const [query, setQuery] = useState("")
  const [isActive, setIsActive] = useState(false)
  const { toast } = useToast()

  const debouncedSearch = useDebounce((searchQuery: string) => {
    if (onSearch && searchQuery.trim()) {
      onSearch(searchQuery)
    }
  }, 500)

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    debouncedSearch(value)
  }

  const handleClear = () => {
    setQuery("")
    setIsActive(false)
    if (onSearch) onSearch("")
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      toast({
        title: "Search",
        description: `Searching for "${query}" - this feature is coming soon!`,
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search books, authors, ISBN..."
          className="pl-10 pr-10 w-full md:w-[300px] lg:w-[400px]"
          value={query}
          onChange={handleSearch}
          onFocus={() => setIsActive(true)}
          onBlur={() => setIsActive(false)}
        />
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </form>
  )
}