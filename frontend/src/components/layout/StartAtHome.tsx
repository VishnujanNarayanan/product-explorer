"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * Every fresh page load starts on the home page.
 *
 * This sits in the root layout, which the App Router keeps mounted across client-side
 * navigation, so the effect runs once per document load and never when you move between
 * pages inside the site. Opening a deep link or refreshing a category therefore lands on
 * home; browsing from there behaves normally.
 *
 * The trade-off is deliberate and worth knowing: a shared or bookmarked URL will not open
 * the page it points at. Deleting this component restores that behaviour.
 */
export function StartAtHome() {
  const router = useRouter()

  useEffect(() => {
    if (window.location.pathname !== "/") {
      router.replace("/")
    }
  }, [router])

  return null
}
