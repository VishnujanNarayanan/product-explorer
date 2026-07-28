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
 * What the live browser session is doing right now.
 *
 * Three states, because "connected" and "working" are different facts and the bar was
 * reporting only the first: a socket can sit open for minutes without a scrape running,
 * and "Live session" during that time reads as a claim that something is happening.
 */
export function WebSocketStatus({ className, onBrand = false }: WebSocketStatusProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [isScraping, setIsScraping] = useState(false)

  useEffect(() => {
    const handleConnect = () => setIsConnected(true)
    const handleDisconnect = () => {
      setIsConnected(false)
      setIsScraping(false)
    }

    // The session reports each step it reaches; only 'scraping' means work in flight.
    const handleScrapeStatus = (data: any) => {
      const status = data?.payload?.status
      if (status === 'scraping' || status === 'active') setIsScraping(true)
      if (status === 'ready' || status === 'idle' || status === 'error') setIsScraping(false)
    }

    // A chunk landing means that request is done, whatever the last status said.
    const handleDataChunk = () => setIsScraping(false)
    const handleError = () => setIsScraping(false)

    setIsConnected(webSocketClient.isConnected())

    webSocketClient.on('connected', handleConnect)
    webSocketClient.on('disconnected', handleDisconnect)
    webSocketClient.on('scrape-status', handleScrapeStatus)
    webSocketClient.on('data-chunk', handleDataChunk)
    webSocketClient.on('error', handleError)

    return () => {
      webSocketClient.off('connected', handleConnect)
      webSocketClient.off('disconnected', handleDisconnect)
      webSocketClient.off('scrape-status', handleScrapeStatus)
      webSocketClient.off('data-chunk', handleDataChunk)
      webSocketClient.off('error', handleError)
    }
  }, [])

  const label = !isConnected ? 'Stored data' : isScraping ? 'Scraping live' : 'Session ready'
  const title = !isConnected
    ? 'No live session — results come from stored data'
    : isScraping
      ? 'A scrape is running on World of Books right now'
      : 'Connected to the live browser session, waiting for a category'

  return (
    <div
      className={cn(
        "flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.14em]",
        onBrand ? "text-brand-muted" : "text-muted-foreground",
        isScraping && "text-highlight",
        className,
      )}
      title={title}
    >
      <span className="relative flex h-1.5 w-1.5">
        {isScraping && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-highlight opacity-75" />
        )}
        <span
          className={cn(
            "relative inline-flex h-1.5 w-1.5 rounded-full",
            isScraping ? "bg-highlight" : isConnected ? "bg-primary" : "bg-muted-foreground/60",
          )}
        />
      </span>
      {label}
    </div>
  )
}
