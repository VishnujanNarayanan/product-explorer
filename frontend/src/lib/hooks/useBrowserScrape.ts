"use client"

import { useCallback, useRef, useState } from "react"
import { scrapeCollectionInBrowser, ScrapedProduct } from "@/lib/scrape/browser-scraper"
import { navigationAPI } from "@/lib/api/navigation"

/**
 * Runs a live scrape from the visitor's own browser.
 *
 * This is the only path that reaches World of Books in production. The API is hosted in a
 * datacentre whose address the storefront answers with 429, while the same request from a
 * visitor's browser is served normally — so the fetch happens here, on their connection, and the
 * server is handed the result to store.
 *
 * Every step is reported through `status` so the page can say what is happening rather than
 * leaving someone watching a spinner.
 */

export type BrowserScrapeStep = "idle" | "fetching" | "saving" | "done" | "failed"

export interface BrowserScrapeState {
  step: BrowserScrapeStep
  /** Sentence describing the current step, suitable for showing as-is. */
  message: string
  products: ScrapedProduct[]
  /** How long the visitor's own fetch took, which is the interesting number to show. */
  durationMs: number | null
  /** Rows the server accepted and stored; null when it was not asked or refused. */
  savedCount: number | null
  error: string | null
}

const IDLE: BrowserScrapeState = {
  step: "idle",
  message: "",
  products: [],
  durationMs: null,
  savedCount: null,
  error: null,
}

export function useBrowserScrape() {
  const [state, setState] = useState<BrowserScrapeState>(IDLE)
  // Pages already taken for a category, so "load more" asks for the next one rather than
  // re-fetching what is already on screen.
  const pageBySlug = useRef<Map<string, number>>(new Map())
  const inFlight = useRef<string | null>(null)

  const reset = useCallback(() => {
    setState(IDLE)
  }, [])

  const scrape = useCallback(
    async (
      slug: string,
      options: { categoryTitle?: string; navigationSlug?: string; nextPage?: boolean } = {},
    ): Promise<ScrapedProduct[]> => {
      // A second click while the first is still running would fetch the same page twice.
      if (inFlight.current === slug) return []
      inFlight.current = slug

      const label = options.categoryTitle || slug
      const page = options.nextPage ? (pageBySlug.current.get(slug) ?? 0) + 1 : 1

      setState({
        ...IDLE,
        step: "fetching",
        message: `Fetching ${page > 1 ? `page ${page} of ` : ""}${label} from World of Books…`,
      })

      try {
        const result = await scrapeCollectionInBrowser(slug, { page })

        if (result.products.length === 0) {
          pageBySlug.current.set(slug, page)
          setState({
            ...IDLE,
            step: "done",
            message: `No more books in ${label} — that is the whole collection.`,
            durationMs: result.durationMs,
          })
          return []
        }

        pageBySlug.current.set(slug, page)

        setState({
          step: "saving",
          message: `Got ${result.products.length} books in ${(result.durationMs / 1000).toFixed(1)}s — saving them…`,
          products: result.products,
          durationMs: result.durationMs,
          savedCount: null,
          error: null,
        })

        // Storing is a bonus: the visitor already has their books. If the server rejects the
        // payload or is asleep, say so quietly rather than turning a successful scrape into an
        // error on screen.
        let savedCount: number | null = null
        try {
          const saved = await navigationAPI.importScrapedProducts(slug, result.products, {
            navigationSlug: options.navigationSlug,
            page,
          })
          savedCount = saved.added
        } catch (error) {
          console.warn("Scraped books could not be saved to the catalogue:", error)
        }

        setState({
          step: "done",
          message:
            savedCount === null
              ? `Scraped ${result.products.length} books in your browser.`
              : `Scraped ${result.products.length} books in your browser and saved ${savedCount} to the catalogue.`,
          products: result.products,
          durationMs: result.durationMs,
          savedCount,
          error: null,
        })

        return result.products
      } catch (error: any) {
        setState({
          ...IDLE,
          step: "failed",
          message: `Could not reach World of Books from this browser.`,
          error: error?.message ?? "Unknown error",
        })
        return []
      } finally {
        inFlight.current = null
      }
    },
    [],
  )

  return {
    ...state,
    isScraping: state.step === "fetching" || state.step === "saving",
    scrape,
    reset,
    /** Highest feed page taken for a category in this session. */
    pageFor: (slug: string) => pageBySlug.current.get(slug) ?? 0,
  }
}
