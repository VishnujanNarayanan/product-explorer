"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowRight } from "lucide-react"
import { Navigation } from "@/lib/types"
import { WebSocketStatus } from "@/components/shared/WebSocketStatus"

interface CategoryBarProps {
  navigation: Navigation[]
}

/**
 * The shelf band: every navigation heading World of Books publishes, with its own
 * categories dropping out beneath it in one flush panel.
 *
 * Pointing at a heading opens its panel; focusing it with the keyboard does the same, so
 * the categories are reachable without a mouse. The heading itself stays a link to the
 * section, so the control is never a dead end.
 */
export function CategoryBar({ navigation }: CategoryBarProps) {
  const [openSlug, setOpenSlug] = useState<string | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const barRef = useRef<HTMLDivElement>(null)

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }, [])

  // Closing is delayed so the pointer can cross the gap between a heading and its panel
  // without the panel vanishing underneath it.
  const scheduleClose = useCallback(() => {
    cancelClose()
    closeTimer.current = setTimeout(() => setOpenSlug(null), 120)
  }, [cancelClose])

  const open = useCallback(
    (slug: string) => {
      cancelClose()
      setOpenSlug(slug)
    },
    [cancelClose],
  )

  useEffect(() => cancelClose, [cancelClose])

  useEffect(() => {
    if (!openSlug) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenSlug(null)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [openSlug])

  if (navigation.length === 0) return null

  const openSection = navigation.find((item) => item.slug === openSlug)

  return (
    <div
      ref={barRef}
      className="relative hidden border-t border-brand-border bg-brand text-brand-foreground lg:block"
      onMouseLeave={scheduleClose}
      onBlur={(event) => {
        // Only close once focus has actually left the bar — moving between a heading and
        // its panel fires blur too.
        if (!barRef.current?.contains(event.relatedTarget as Node)) setOpenSlug(null)
      }}
    >
      <div className="container">
        <div className="flex items-stretch justify-between">
          <nav aria-label="Book sections" className="flex items-stretch">
            {navigation.map((section) => {
              const isOpen = openSlug === section.slug
              return (
                <Link
                  key={section.id}
                  href={`/categories?navigation=${section.slug}`}
                  aria-expanded={isOpen}
                  aria-haspopup="true"
                  onMouseEnter={() => open(section.slug)}
                  onFocus={() => open(section.slug)}
                  onClick={() => setOpenSlug(null)}
                  className={`relative flex items-center px-4 py-3.5 text-sm font-medium transition-colors ${
                    isOpen
                      ? "bg-brand-border/60 text-brand-foreground"
                      : "text-brand-foreground/80 hover:text-brand-foreground"
                  }`}
                >
                  {section.title}
                  <span
                    aria-hidden
                    className={`absolute inset-x-3 bottom-0 h-0.5 bg-highlight transition-opacity ${
                      isOpen ? "opacity-100" : "opacity-0"
                    }`}
                  />
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center pl-6">
            <WebSocketStatus onBrand />
          </div>
        </div>
      </div>

      {openSection && (
        <div
          className="absolute inset-x-0 top-full z-50 animate-panel-in border-b border-border bg-popover text-popover-foreground shadow-panel"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          {/* The one ochre edge on the page — it marks the drawer that just opened. */}
          <div aria-hidden className="h-0.5 w-full bg-highlight" />
          <MegaPanel section={openSection} onNavigate={() => setOpenSlug(null)} />
        </div>
      )}
    </div>
  )
}

function MegaPanel({
  section,
  onNavigate,
}: {
  section: Navigation
  onNavigate: () => void
}) {
  const categories = section.categories ?? []

  return (
    <div className="container py-8">
      <div className="flex gap-10">
        {/* Shelf label: what you are looking at, and the way out of the panel. */}
        <div className="w-52 flex-shrink-0 border-r border-border pr-8">
          <p className="label-meta">Section</p>
          <h2 className="mt-2 font-display text-2xl font-semibold leading-tight">
            {section.title}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {categories.length} {categories.length === 1 ? "category" : "categories"}
          </p>
          <Link
            href={`/categories?navigation=${section.slug}`}
            onClick={onNavigate}
            className="group mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            Browse the whole section
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="min-w-0 flex-1">
          {categories.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              No categories stored for this section yet. Open the section to scrape it.
            </p>
          ) : (
            <div className="scrollbar-thin max-h-[60vh] gap-x-8 overflow-y-auto columns-3 xl:columns-4">
              {categories.map((category) => (
                <Link
                  key={`${section.slug}-${category.id}`}
                  href={`/products?category=${category.slug}&navigation=${section.slug}`}
                  onClick={onNavigate}
                  className="mb-0.5 flex break-inside-avoid items-baseline justify-between gap-3 border-l-2 border-transparent py-1.5 pl-3 text-sm text-muted-foreground transition-colors hover:border-highlight hover:text-foreground focus-visible:border-highlight focus-visible:text-foreground"
                >
                  <span className="truncate">{category.title}</span>
                  {category.product_count > 0 && (
                    <span className="flex-shrink-0 font-mono text-[0.6875rem] text-highlight">
                      {category.product_count}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
