import { useSocket } from "@/context/SocketContext"
import { useTerminal } from "@/context/TerminalContext"
import { useEffect, useState } from "react"
import { toast } from "sonner"

export interface SocketEventHandlers {
  onTerminalResponse: (response: { id: string; data: string }) => void
  onPreviewURL: (url: string) => void
}

export interface UseEditorSocketProps {
  isOwner: boolean
  handlers: SocketEventHandlers
}

export interface UseEditorSocketReturn {
  socket: any
  timeoutDialog: boolean
  setTimeoutDialog: (value: boolean) => void
}

export const useEditorSocket = ({
  isOwner,
  handlers,
}: UseEditorSocketProps): UseEditorSocketReturn => {
  const { socket } = useSocket()
  const [timeoutDialog, setTimeoutDialog] = useState(false)
  const { terminals } = useTerminal()

  // Heartbeat effect to prevent sandbox timeout & Socket connection/disconnection management
  useEffect(() => {
    if (!socket) return
    socket.connect()
    // 10000 ms = 10 seconds
    const interval = setInterval(
      () =>
        socket.emit("heartbeat", {}, (success: boolean) => {
          if (!success) {
            setTimeoutDialog(true)
          }
        }),
      10000
    )

    return () => {
      socket.disconnect()
      clearInterval(interval)
    }
  }, [socket])

  // Socket event listeners
  useEffect(() => {
    if (!socket) return

    const onConnect = () => {
      console.log("Socket connected")
    }

    const onDisconnect = () => {
      console.log("Socket disconnected")
      // Clear terminals on disconnect
      // Note: This will be handled by the parent component via handlers
    }

    const onError = (message: string) => {
      toast.error(message)
    }

    const onTerminalResponse = (response: { id: string; data: string }) => {
      handlers.onTerminalResponse(response)
    }

    const onPreviewURL = (url: string) => {
      handlers.onPreviewURL(url)
    }

    // Register event listeners
    socket.on("connect", onConnect)
    socket.on("disconnect", onDisconnect)
    socket.on("error", onError)
    socket.on("terminalResponse", onTerminalResponse)
    socket.on("previewURL", onPreviewURL)

    // Cleanup function
    return () => {
      socket.off("connect", onConnect)
      socket.off("disconnect", onDisconnect)
      socket.off("error", onError)
      socket.off("terminalResponse", onTerminalResponse)
      socket.off("previewURL", onPreviewURL)
    }
  }, [socket, terminals, handlers, isOwner])

  return {
    socket,
    timeoutDialog,
    setTimeoutDialog,
  }
}
