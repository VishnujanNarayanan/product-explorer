import { toast } from "react-hot-toast"

export function useToast() {
  return {
    toast: (options: {
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
    }
  }
}