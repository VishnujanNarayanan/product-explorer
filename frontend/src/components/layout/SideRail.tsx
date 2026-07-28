"use client"

import Link from "next/link"
import { useCallback } from "react"
import { cn } from "@/lib/utils"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"

export interface SideRailItem {
  id: string | number
  title: string
  /** Shown right-aligned in mono when greater than zero. */
  count?: number
  /** Render as a link when the destination is a plain page. */
  href?: string
  isActive?: boolean
}

interface SideRailProps {
  label: string
  /** Where this list came from, e.g. the navigation heading. */
  context?: string
  items: SideRailItem[]
  isLoading?: boolean
  emptyMessage?: string
  /** Used when items carry no href — the products page re-scrapes on select. */
  onSelect?: (item: SideRailItem) => void
}

/**
 * The list rail beside a catalogue page.
 *
 * Flush hairlines rather than a floating card: this is a table of contents for the page
 * next to it, not a panel hovering over it. The active row is the only filled surface,
 * marked with the same ochre the counts use.
 */
export function SideRail({
  label,
  context,
  items,
  isLoading = false,
  emptyMessage = "Nothing here yet",
  onSelect,
}: SideRailProps) {
  /**
   * A section can hold thirty categories, so the one you are reading is often below the
   * fold of the rail's own scroll area. Bring it into view when it mounts.
   */
  const focusActive = useCallback((node: HTMLElement | null) => {
    node?.scrollIntoView({ block: "nearest" })
  }, [])

  const rowClass = (isActive?: boolean) =>
    cn(
      "flex w-full items-baseline justify-between gap-3 border-l-2 px-3 py-2.5 text-left text-sm transition-colors",
      isActive
        ? "border-highlight bg-secondary font-medium text-foreground"
        : "border-transparent text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
    )

  return (
    <aside className="w-full flex-shrink-0 lg:w-64">
      <div className="lg:sticky lg:top-24">
        <p className="label-meta">{label}</p>
        {context && <p className="mt-1 text-sm text-muted-foreground">{context}</p>}

        <nav
          aria-label={label}
          className="scrollbar-thin mt-4 divide-y divide-border border-y border-border lg:max-h-[calc(100vh-13rem)] lg:overflow-y-auto"
        >
          {isLoading && items.length === 0 ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="sm" />
            </div>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-sm text-muted-foreground">{emptyMessage}</p>
          ) : (
            items.map((item) =>
              item.href ? (
                <Link
                  key={item.id}
                  href={item.href}
                  ref={item.isActive ? focusActive : undefined}
                  className={rowClass(item.isActive)}
                >
                  <span className="truncate">{item.title}</span>
                  <Count value={item.count} />
                </Link>
              ) : (
                <button
                  key={item.id}
                  type="button"
                  ref={item.isActive ? focusActive : undefined}
                  onClick={() => onSelect?.(item)}
                  aria-current={item.isActive ? "true" : undefined}
                  className={rowClass(item.isActive)}
                >
                  <span className="truncate">{item.title}</span>
                  <Count value={item.count} />
                </button>
              ),
            )
          )}
        </nav>
      </div>
    </aside>
  )
}

function Count({ value }: { value?: number }) {
  if (!value) return null
  return (
    <span className="flex-shrink-0 font-mono text-[0.6875rem] text-highlight">{value}</span>
  )
}
