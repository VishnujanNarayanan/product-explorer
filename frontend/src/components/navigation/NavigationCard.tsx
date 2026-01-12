    import Link from "next/link"
import { ArrowRight, BookOpen } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Navigation } from "@/lib/types"

interface NavigationCardProps {
  navigation: Navigation
  className?: string
}

export function NavigationCard({ navigation, className }: NavigationCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          {navigation.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Explore {navigation.title.toLowerCase()} from World of Books
        </p>
        <div className="space-y-2">
          {navigation.categories?.slice(0, 3).map((category) => (
            <div
              key={category.id}
              className="flex items-center justify-between text-sm"
            >
              <span>{category.title}</span>
              <span className="text-muted-foreground">
                {category.product_count} items
              </span>
            </div>
          ))}
        </div>
        <Link href={`/categories?navigation=${navigation.slug}`} className="mt-4">
          <Button variant="outline" className="w-full">
            Explore
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}