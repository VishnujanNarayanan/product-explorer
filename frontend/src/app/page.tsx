"use client"

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Loader2, RefreshCw, Shuffle } from 'lucide-react'
import { ProductCard } from '@/components/product/ProductCard'
import { useNavigation } from '@/lib/hooks/useNavigation'
import { useRandomProducts } from '@/lib/hooks/useRandomProducts'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/lib/hooks/useToast'

export default function Home() {
  const { navigation, isLoading: isLoadingNavigation, error, refreshNavigation } = useNavigation()
  const { products, total, isLoading: isLoadingProducts, reshuffle } = useRandomProducts(10)
  const { toast } = useToast()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [hasAttemptedRefresh, setHasAttemptedRefresh] = useState(false)

  useEffect(() => {
    // A first-run install has no navigation stored. Fetch it once rather than leaving
    // someone on an empty page wondering what to press.
    if (!isLoadingNavigation && !isRefreshing && navigation.length === 0 && !hasAttemptedRefresh) {
      setHasAttemptedRefresh(true)
      handleRefreshNavigation()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingNavigation, isRefreshing, navigation.length, hasAttemptedRefresh])

  const handleRefreshNavigation = async () => {
    setIsRefreshing(true)
    try {
      const result = await refreshNavigation()
      if (result?.data && result.data.length > 0) {
        toast({
          title: "Sections updated",
          description: `${result.data.length} sections loaded from World of Books`,
        })
      } else {
        toast({
          title: "Scrape queued",
          description: "The sections will appear once the scrape finishes.",
        })
      }
    } catch {
      toast({
        title: "Could not reach World of Books",
        description: "The sections could not be refreshed. Try again in a moment.",
        variant: "destructive",
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  const categoryCount = navigation.reduce((sum, nav) => sum + (nav.categories?.length || 0), 0)
  // The hero shelf and the grid draw from the same sample; the shelf takes the first few
  // covers so nothing is fetched twice.
  const shelf = products.slice(0, 5)

  return (
    <div>
      {/* Hero: the catalogue itself, standing on a shelf. */}
      <section className="border-b bg-card">
        <div className="container grid items-end gap-12 py-16 lg:grid-cols-12 lg:py-20">
          <div className="lg:col-span-5">
            <p className="label-meta">Second-hand books · scraped live</p>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              Every shelf at World of Books, one click deep.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">
              Pick a section from the bar above and we open it in a real browser session —
              the books arrive as the page is walked, then stay stored for the next visit.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {navigation[1] && (
                <Button asChild size="lg">
                  <Link href={`/categories?navigation=${navigation[1].slug}`}>
                    Browse {navigation[1].title}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              )}
              <Button variant="outline" size="lg" onClick={reshuffle} disabled={isLoadingProducts}>
                <Shuffle className={`mr-2 h-4 w-4 ${isLoadingProducts ? 'animate-spin' : ''}`} />
                Shuffle the shelf
              </Button>
            </div>
          </div>

          {/* min-w-0: without it the shelf's own min-content width pushes the grid track
              wider than the viewport, and the whole page scrolls sideways on a phone. */}
          <div className="min-w-0 lg:col-span-7">
            <Shelf products={shelf} isLoading={isLoadingProducts} />
          </div>
        </div>

        {/* Honest counts, taken from what is actually stored. */}
        <div className="border-t">
          <dl className="container grid grid-cols-3 divide-x divide-border">
            <Stat label="Books stored" value={total ? total.toLocaleString() : '—'} />
            <Stat label="Sections" value={navigation.length || '—'} />
            <Stat label="Categories" value={categoryCount || '—'} />
          </dl>
        </div>
      </section>

      {/* A random draw from storage — a different shelf on every arrival. */}
      <section className="container py-14">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
          <div>
            <p className="label-meta">From the stockroom</p>
            <h2 className="mt-2 font-display text-3xl font-semibold">A random shelf</h2>
          </div>
          <Button variant="outline" onClick={reshuffle} disabled={isLoadingProducts}>
            <Shuffle className={`mr-2 h-4 w-4 ${isLoadingProducts ? 'animate-spin' : ''}`} />
            Shuffle
          </Button>
        </div>

        <div className="mt-8 grid gap-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {isLoadingProducts && products.length === 0
            ? Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="overflow-hidden rounded-lg border">
                  <div className="skeleton aspect-[3/4] rounded-none" />
                  <div className="space-y-2 border-t p-4">
                    <div className="skeleton h-4" />
                    <div className="skeleton h-3 w-2/3" />
                  </div>
                </div>
              ))
            : products.map((product) => (
                <ProductCard key={`${product.category?.id}-${product.id}`} product={product} />
              ))}
        </div>

        {!isLoadingProducts && products.length === 0 && (
          <div className="mt-8 rounded-lg border border-dashed p-12 text-center">
            <p className="font-medium">No books stored yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Open a category from the bar above — the first visit scrapes it.
            </p>
          </div>
        )}
      </section>

      {/* Sections, with their categories visible rather than a click away. */}
      <section className="border-t bg-card">
        <div className="container py-14">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
            <div>
              <p className="label-meta">The whole catalogue</p>
              <h2 className="mt-2 font-display text-3xl font-semibold">Browse by section</h2>
            </div>
            <Button
              variant="ghost"
              onClick={handleRefreshNavigation}
              disabled={isRefreshing || isLoadingNavigation}
            >
              {isRefreshing || isLoadingNavigation ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Re-scrape sections
            </Button>
          </div>

          {error && navigation.length === 0 ? (
            <div className="mt-8 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
              <p className="font-medium text-destructive">
                World of Books could not be reached
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                The sections are scraped on demand. Try again once you are back online.
              </p>
            </div>
          ) : (
            <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {navigation.map((section) => {
                const categories = section.categories ?? []
                return (
                  <div key={section.id} className="rounded-lg border bg-background p-6">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="font-display text-xl font-semibold">{section.title}</h3>
                      <span className="font-mono text-xs text-muted-foreground">
                        {categories.length}
                      </span>
                    </div>
                    <ul className="mt-4 space-y-1">
                      {categories.slice(0, 5).map((category) => (
                        <li key={category.id}>
                          <Link
                            href={`/products?category=${category.slug}&navigation=${section.slug}`}
                            className="flex items-baseline justify-between gap-3 border-l-2 border-transparent py-1 pl-3 text-sm text-muted-foreground transition-colors hover:border-highlight hover:text-foreground"
                          >
                            <span className="truncate">{category.title}</span>
                            {category.product_count > 0 && (
                              <span className="font-mono text-[0.6875rem] text-highlight">
                                {category.product_count}
                              </span>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={`/categories?navigation=${section.slug}`}
                      className="group mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                    >
                      All {categories.length} categories
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="py-5 pr-6 first:pl-0 [&:not(:first-child)]:pl-6">
      <dt className="label-meta">{label}</dt>
      <dd className="mt-1 font-mono text-xl">{value}</dd>
    </div>
  )
}

/**
 * Covers standing on a rule, bottom-aligned the way books sit on a shelf. Heights vary by
 * position rather than at random so the row does not reshuffle its own geometry on every
 * render.
 */
function Shelf({ products, isLoading }: { products: any[]; isLoading: boolean }) {
  const heights = ['h-40', 'h-48', 'h-44', 'h-52', 'h-44']

  if (isLoading && products.length === 0) {
    return (
      <div className="scrollbar-thin flex items-end gap-4 overflow-x-auto border-b-2 border-foreground/80">
        {heights.map((height, i) => (
          <div key={i} className={`skeleton w-28 ${height} rounded-none rounded-t-sm`} />
        ))}
      </div>
    )
  }

  if (products.length === 0) return null

  return (
    <div className="scrollbar-thin flex items-end gap-4 overflow-x-auto border-b-2 border-foreground/80 sm:gap-6">
      {products.map((product, i) => (
        <Link
          key={`${product.category?.id}-${product.id}`}
          href={`/products/${product.source_id}`}
          title={product.title}
          className="group relative block flex-shrink-0 transition-transform duration-300 hover:-translate-y-1"
        >
          <div
            className={`relative w-24 ${heights[i % heights.length]} overflow-hidden rounded-t-sm bg-white shadow-rise sm:w-28`}
          >
            <Image
              src={product.image_url}
              alt={product.title}
              fill
              className="object-cover"
              sizes="112px"
            />
          </div>
        </Link>
      ))}
    </div>
  )
}
