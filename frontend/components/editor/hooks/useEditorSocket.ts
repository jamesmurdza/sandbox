import { useSocket } from "@/context/SocketContext"
import { useTerminal } from "@/context/TerminalContext"
import { useCallback, useEffect } from "react"
import { toast } from "sonner"

export interface UseEditorSocketProps {
  isOwner: boolean
  loadPreviewURL: (url: string) => void
}

export const useEditorSocket = ({
  isOwner,
  loadPreviewURL,
}: UseEditorSocketProps) => {
  const { socket } = useSocket()
  const { terminals } = useTerminal()

  // Initialize socket connection
  useEffect(() => {
    if (!socket) return
    socket.connect()
  }, [socket])

  // Terminal response handler
  const handleTerminalResponse = useCallback(
    (response: { id: string; data: string }) => {
      const term = terminals.find((t) => t.id === response.id)
      if (term?.terminal) {
        term.terminal.write(response.data)
      }
    },
    [terminals]
  )

  // Preview URL handler
  const handlePreviewURL = useCallback(
    (url: string) => {
      loadPreviewURL(url)
    },
    [loadPreviewURL]
  )

  // Register socket event listeners
  useEffect(() => {
    if (!socket) return

    const onConnect = () => {
      console.log("Socket connected")
    }

    const onDisconnect = () => {
      console.log("Socket disconnected")
      // You could trigger timeoutDialog here if needed
    }

    const onError = (message: string) => {
      toast.error(message)
    }

    // Register events
    socket.on("connect", onConnect)
    socket.on("disconnect", onDisconnect)
    socket.on("error", onError)
    socket.on("terminalResponse", handleTerminalResponse)
    socket.on("previewURL", handlePreviewURL)

    return () => {
      socket.off("connect", onConnect)
      socket.off("disconnect", onDisconnect)
      socket.off("error", onError)
      socket.off("terminalResponse", handleTerminalResponse)
      socket.off("previewURL", handlePreviewURL)
    }
  }, [socket, handleTerminalResponse, handlePreviewURL])

  return {
    socket,
  }
}
