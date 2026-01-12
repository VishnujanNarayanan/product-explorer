"use client"

import React from "react"
import { Button } from "./Button"
import { AlertCircle } from "lucide-react"

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 p-8">
            <AlertCircle className="mb-4 h-12 w-12 text-destructive" />
            <h2 className="mb-2 text-xl font-semibold">Something went wrong</h2>
            <p className="mb-4 text-center text-muted-foreground">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                this.setState({ hasError: false, error: undefined })
                window.location.reload()
              }}
            >
              Try again
            </Button>
          </div>
        )
      )
    }

    return this.props.children
  }
}

export function ErrorFallback({ error }: { error: Error }) {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <AlertCircle className="mb-4 h-12 w-12 text-destructive" />
      <h2 className="mb-2 text-xl font-semibold">Error</h2>
      <p className="mb-4 text-center text-muted-foreground">{error.message}</p>
      <Button
        variant="outline"
        onClick={() => window.location.reload()}
      >
        Reload page
      </Button>
    </div>
  )
}