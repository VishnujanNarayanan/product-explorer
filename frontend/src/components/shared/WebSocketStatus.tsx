// frontend/src/components/shared/WebSocketStatus.tsx
"use client"

import { useEffect, useState } from "react"
import { Wifi, WifiOff, Circle } from "lucide-react"
import { cn } from "@/lib/utils"
import { webSocketClient } from "@/lib/api/websocket"

export function WebSocketStatus({ className }: { className?: string }) {
  const [isConnected, setIsConnected] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)

  useEffect(() => {
    const handleConnect = () => {
      setIsConnected(true)
      setSessionId(webSocketClient.getSessionId())
    }

    const handleDisconnect = () => {
      setIsConnected(false)
      setSessionId(null)
    }

    // Initial state
    setIsConnected(webSocketClient.isConnected())
    setSessionId(webSocketClient.getSessionId())

    // Listen for changes
    webSocketClient.on('connected', handleConnect)
    webSocketClient.on('disconnected', handleDisconnect)
    webSocketClient.on('session-ready', () => {
      setSessionId(webSocketClient.getSessionId())
    })

    return () => {
      webSocketClient.off('connected', handleConnect)
      webSocketClient.off('disconnected', handleDisconnect)
    }
  }, [])

  return (
    <div className={cn("flex items-center gap-2 text-sm", className)}>
      {isConnected ? (
        <>
          <div className="flex items-center gap-1.5 text-green-600">
            <div className="relative">
              <Wifi className="h-4 w-4" />
              <Circle className="h-2 w-2 absolute -top-0.5 -right-0.5 fill-green-600 text-green-600 animate-ping" />
            </div>
            <span className="font-medium">Live</span>
          </div>
          {sessionId && (
            <span className="text-xs text-muted-foreground font-mono">
              {sessionId.slice(0, 8)}...
            </span>
          )}
        </>
      ) : (
        <div className="flex items-center gap-1.5 text-red-600">
          <WifiOff className="h-4 w-4" />
          <span className="font-medium">Offline</span>
        </div>
      )}
    </div>
  )
}