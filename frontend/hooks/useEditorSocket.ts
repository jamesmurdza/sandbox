import { useSocket } from "@/context/SocketContext"
import { Sandbox, TFile, TFolder, User } from "@/lib/types"
import { Terminal } from "@xterm/xterm"
import { useEffect, useState } from "react"
import { toast } from "sonner"

export interface SocketEventHandlers {
  onFileLoaded: (files: (TFolder | TFile)[]) => void
  onTerminalResponse: (response: { id: string; data: string }) => void
  onDisableAccess: (message: string) => void
  onPreviewURL: (url: string) => void
}

export interface UseEditorSocketProps {
  userData: User
  sandboxData: Sandbox
  isOwner: boolean
  terminals: { id: string; terminal: Terminal | null }[]
  handlers: SocketEventHandlers
}

export interface UseEditorSocketReturn {
  socket: any
  timeoutDialog: boolean
  setTimeoutDialog: (value: boolean) => void
}

export const useEditorSocket = ({
  userData,
  sandboxData,
  isOwner,
  terminals,
  handlers,
}: UseEditorSocketProps): UseEditorSocketReturn => {
  const { socket, setUserAndSandboxId } = useSocket()
  const [timeoutDialog, setTimeoutDialog] = useState(false)

  // Socket connection initialization
  useEffect(() => {
    // Ensure userData.id and sandboxData.id are available before attempting to connect
    if (userData.id && sandboxData.id) {
      // Check if the socket is not initialized or not connected
      if (!socket || (socket && !socket.connected)) {
        // Initialize socket connection
        setUserAndSandboxId(userData.id, sandboxData.id)
      }
    }
  }, [socket, userData.id, sandboxData.id, setUserAndSandboxId])

  // Heartbeat effect to prevent sandbox timeout
  useEffect(() => {
    if (!socket) return

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

    return () => clearInterval(interval)
  }, [socket])

  // Socket connection/disconnection management
  useEffect(() => {
    if (!socket) return

    socket.connect()

    return () => {
      socket.disconnect()
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

    const onLoadedEvent = (files: (TFolder | TFile)[]) => {
      handlers.onFileLoaded(files)
    }

    const onError = (message: string) => {
      toast.error(message)
    }

    const onTerminalResponse = (response: { id: string; data: string }) => {
      handlers.onTerminalResponse(response)
    }

    const onDisableAccess = (message: string) => {
      handlers.onDisableAccess(message)
    }

    const onPreviewURL = (url: string) => {
      handlers.onPreviewURL(url)
    }

    // Register event listeners
    socket.on("connect", onConnect)
    socket.on("disconnect", onDisconnect)
    socket.on("loaded", onLoadedEvent)
    socket.on("error", onError)
    socket.on("terminalResponse", onTerminalResponse)
    socket.on("disableAccess", onDisableAccess)
    socket.on("previewURL", onPreviewURL)

    // Cleanup function
    return () => {
      socket.off("connect", onConnect)
      socket.off("disconnect", onDisconnect)
      socket.off("loaded", onLoadedEvent)
      socket.off("error", onError)
      socket.off("terminalResponse", onTerminalResponse)
      socket.off("disableAccess", onDisableAccess)
      socket.off("previewURL", onPreviewURL)
    }
  }, [socket, terminals, handlers, isOwner])

  return {
    socket,
    timeoutDialog,
    setTimeoutDialog,
  }
}
