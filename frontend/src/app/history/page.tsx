"use client"

import { Clock, Eye, Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { useHistory } from "@/lib/hooks/useHistory"
import { formatDateTime } from "@/lib/utils"
import Link from "next/link"

export default function HistoryPage() {
  const { viewHistory, isLoading, clearHistory } = useHistory()

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Clock className="mx-auto h-12 w-12 text-muted-foreground animate-spin" />
          <p className="mt-4 text-muted-foreground">Loading history...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold">Browsing History</h1>
        <p className="text-lg text-muted-foreground">
          Your recent activity on World of Books Explorer
        </p>
      </div>

      {viewHistory.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Eye className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No browsing history</h3>
            <p className="mt-2 text-muted-foreground">
              Your viewed products will appear here
            </p>
            <Button className="mt-4" asChild>
              <Link href="/products">Browse Products</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={clearHistory}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Clear All History
            </Button>
          </div>

          <div className="space-y-4">
            {viewHistory.map((item) => {
              const pathData = item.path_json
              const isProduct = pathData?.path?.includes('/products/')
              
              return (
                <Card key={item.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <Eye className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold">
                              {isProduct && pathData.data?.title
                                ? pathData.data.title
                                : pathData?.path || 'Unknown'}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              {pathData?.path || 'No path information'}
                            </p>
                          </div>
                          <div className="text-sm text-muted-foreground whitespace-nowrap">
                            {formatDateTime(item.created_at)}
                          </div>
                        </div>
                        
                        {isProduct && pathData.data && (
                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Category</p>
                              <p className="text-sm">
                                {pathData.data.category?.title || 'Unknown'}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Price</p>
                              <p className="text-sm">
                                {pathData.data.price 
                                  ? `£${pathData.data.price.toFixed(2)}`
                                  : 'Price unavailable'}
                              </p>
                            </div>
                          </div>
                        )}

                        {pathData?.path && (
                          <div className="mt-4">
                            <Button variant="outline" size="sm" asChild>
                              <Link href={pathData.path}>
                                View Again
                              </Link>
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}