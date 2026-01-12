import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Product } from "@/lib/types"

interface ProductDescriptionProps {
  product: Product
}

export function ProductDescription({ product }: ProductDescriptionProps) {
  const description = product.detail?.description || "No description available."
  const specs = product.detail?.specs || {}

  return (
    <div className="space-y-6">
      {/* Description */}
      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose max-w-none dark:prose-invert">
            {description.split('\n').map((paragraph, index) => (
              <p key={index} className="mb-4 last:mb-0">
                {paragraph}
              </p>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Specifications */}
      {Object.keys(specs).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Specifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {Object.entries(specs).map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <div className="text-sm font-medium capitalize">
                    {key.replace(/_/g, ' ')}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {String(value) || 'Not specified'}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}