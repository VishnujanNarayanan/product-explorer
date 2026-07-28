"use client"

import Image from "next/image"
import Link from "next/link"
import { ImageOff, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { useHistory } from "@/lib/hooks/useHistory"

/** "3 minutes ago" while that is the useful answer, an absolute date once it is not. */
function timeAgo(iso: string) {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function HistoryPage() {
  const { viewHistory, isLoading, clearHistory } = useHistory()

  return (
    <div className="container space-y-8 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-6">
        <div>
          <p className="label-meta">This browser</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">
            Books you have opened
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {viewHistory.length > 0
              ? `The last ${viewHistory.length} ${viewHistory.length === 1 ? 'book' : 'books'}, most recent first. Kept on this device only.`
              : 'Kept on this device only — nothing is sent anywhere.'}
          </p>
        </div>
        {viewHistory.length > 0 && (
          <Button variant="outline" onClick={clearHistory} className="gap-2">
            <Trash2 className="h-4 w-4" />
            Clear history
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="divide-y divide-border border-y border-border">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-5 py-4">
              <div className="skeleton h-24 w-16 flex-shrink-0" />
              <div className="w-full space-y-2">
                <div className="skeleton h-4 w-1/3" />
                <div className="skeleton h-3 w-1/5" />
              </div>
            </div>
          ))}
        </div>
      ) : viewHistory.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="font-medium">You have not opened a book yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Pick a section from the bar above and open something — it gets listed here so you
            can find your way back to it.
          </p>
          <Button asChild className="mt-6" variant="outline">
            <Link href="/">Start browsing</Link>
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {viewHistory.map((book) => (
            <li key={book.source_id}>
              <Link
                href={`/products/${book.source_id}`}
                className="group flex items-center gap-5 border-l-2 border-transparent py-4 pl-3 transition-colors hover:border-highlight hover:bg-secondary/40"
              >
                <div className="relative h-24 w-16 flex-shrink-0 overflow-hidden rounded-sm bg-secondary">
                  {book.image_url ? (
                    <Image
                      src={book.image_url}
                      alt=""
                      fill
                      className="object-contain"
                      sizes="64px"
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center text-muted-foreground">
                      <ImageOff className="h-4 w-4" />
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{book.title}</p>
                  {book.author && (
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      by {book.author}
                    </p>
                  )}
                  {book.category && (
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      in {book.category}
                    </p>
                  )}
                </div>

                <div className="flex-shrink-0 text-right">
                  {book.price !== null && (
                    <p className="font-mono text-sm text-highlight">£{book.price}</p>
                  )}
                  <p className="mt-1 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground">
                    {timeAgo(book.viewed_at)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
