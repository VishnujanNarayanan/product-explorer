import { Star, User } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Review } from "@/lib/types"
import { formatDate } from "@/lib/utils"

interface ProductReviewsProps {
  reviews: Review[]
  averageRating?: number
  totalReviews?: number
}

export function ProductReviews({ 
  reviews, 
  averageRating = 0, 
  totalReviews = 0 
}: ProductReviewsProps) {
  const ratingDistribution = {
    5: reviews.filter(r => r.rating === 5).length,
    4: reviews.filter(r => r.rating === 4).length,
    3: reviews.filter(r => r.rating === 3).length,
    2: reviews.filter(r => r.rating === 2).length,
    1: reviews.filter(r => r.rating === 1).length,
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Customer Reviews</span>
          <span className="text-lg font-semibold">
            {averageRating.toFixed(1)} out of 5
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {reviews.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No reviews yet. Be the first to review this product!
          </p>
        ) : (
          <div className="space-y-8">
            {/* Rating Summary */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-4xl font-bold">{averageRating.toFixed(1)}</div>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-5 w-5 ${
                        star <= Math.floor(averageRating)
                          ? "fill-yellow-400 text-yellow-400"
                          : star === Math.ceil(averageRating) && averageRating % 1 >= 0.25
                          ? "fill-yellow-400/50 text-yellow-400"
                          : "text-muted-foreground"
                      }`}
                    />
                  ))}
                </div>
                <div className="text-sm text-muted-foreground">
                  Based on {totalReviews} review{totalReviews !== 1 ? 's' : ''}
                </div>
              </div>
              <div className="space-y-2">
                {[5, 4, 3, 2, 1].map((rating) => {
                  const count = ratingDistribution[rating as keyof typeof ratingDistribution]
                  const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0
                  return (
                    <div key={rating} className="flex items-center gap-2">
                      <div className="w-12 text-sm">{rating} stars</div>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-yellow-400 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="w-12 text-right text-sm text-muted-foreground">
                        {count}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Reviews List */}
            <div className="space-y-6">
              {reviews.map((review) => (
                <div key={review.id} className="border-t pt-6 first:border-t-0 first:pt-0">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        <User className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-medium">{review.author}</div>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-3 w-3 ${
                                star <= review.rating
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-muted-foreground"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(review.created_at)}
                    </div>
                  </div>
                  <p className="text-sm">{review.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}