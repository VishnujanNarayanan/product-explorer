import { NavigationCard } from "./NavigationCard"
import { Navigation } from "@/lib/types"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"

interface NavigationGridProps {
  navigation: Navigation[]
  isLoading?: boolean
}

export function NavigationGrid({ navigation, isLoading }: NavigationGridProps) {
  if (isLoading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-48 animate-pulse rounded-lg bg-muted"
          />
        ))}
      </div>
    )
  }

  if (!navigation.length) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground">No navigation items found</p>
      </div>
    )
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {navigation.map((item) => (
        <NavigationCard key={item.id} navigation={item} />
      ))}
    </div>
  )
}