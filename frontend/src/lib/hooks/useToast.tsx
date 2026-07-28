import { useCallback } from "react"
import { toast } from "react-hot-toast"

/**
 * Toasts.
 *
 * The title used to be discarded — every toast in the app rendered `description || title`,
 * so "Opening Graphic Novels" arrived on screen as "Picking the category on World of
 * Books…" with no clue which category it meant. Both lines are shown now: the title says
 * what happened, the description adds the detail.
 */
export function useToast() {
  // Stable identity: consumers put `toast` in effect/useMemo dependency arrays, and a fresh
  // function each render would re-run those effects (re-registering WebSocket listeners) on
  // every render.
  const show = useCallback((options: {
    title: string
    description?: string
    variant?: "default" | "destructive"
  }) => {
    const { title, description, variant = "default" } = options

    const body = (
      <span className="block">
        <span className="block text-sm font-medium">{title}</span>
        {description && (
          <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
        )}
      </span>
    )

    if (variant === "destructive") {
      return toast.error(body, { duration: 5000, position: "top-right" })
    }

    return toast.success(body, { duration: 3000, position: "top-right" })
  }, [])

  return { toast: show }
}
