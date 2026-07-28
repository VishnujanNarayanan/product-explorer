// frontend/src/components/shared/WebSocketStatus.tsx
"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { webSocketClient } from "@/lib/api/websocket"

interface WebSocketStatusProps {
  className?: string
  /** Style for the dark navigation band rather than a light surface. */
  onBrand?: boolean
}

/**
 * Whether the live browser session is connected. Deliberately quiet: a dot and a word,
 * in the same mono face the rest of the app uses for machine state.
 */
export function WebSocketStatus({ className, onBrand = false }: WebSocketStatusProps) {
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    const handleConnect = () => setIsConnected(true)
    const handleDisconnect = () => setIsConnected(false)

    setIsConnected(webSocketClient.isConnected())

    webSocketClient.on('connected', handleConnect)
    webSocketClient.on('disconnected', handleDisconnect)

    return () => {
      webSocketClient.off('connected', handleConnect)
      webSocketClient.off('disconnected', handleDisconnect)
    }
  }, [])

  return (
    <div
      className={cn(
        "flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.14em]",
        onBrand ? "text-brand-muted" : "text-muted-foreground",
        className,
      )}
      title={
        isConnected
          ? "Connected to the live browser session"
          : "No live session — results come from stored data"
      }
    >
      <span className="relative flex h-1.5 w-1.5">
        {isConnected && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-highlight opacity-75" />
        )}
        <span
          className={cn(
            "relative inline-flex h-1.5 w-1.5 rounded-full",
            isConnected ? "bg-highlight" : "bg-muted-foreground/60",
          )}
        />
      </span>
      {isConnected ? "Live session" : "Stored data"}
    </div>
  )
}
