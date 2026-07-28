import { useCallback } from "react"
import { toast } from "react-hot-toast"

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

    if (variant === "destructive") {
      return toast.error(description || title, {
        duration: 5000,
        position: "top-right",
      })
    }

    return toast.success(description || title, {
      duration: 3000,
      position: "top-right",
    })
  }, [])

  return { toast: show }
}
