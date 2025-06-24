import { useSocket } from "@/context/SocketContext"
import { useCallback, useEffect } from "react"
import { toast } from "sonner"

export interface UseEditorSocketProps {
  loadPreviewURL: (url: string) => void
}

export const useEditorSocket = ({ loadPreviewURL }: UseEditorSocketProps) => {
  const { socket } = useSocket()

  // Initialize socket connection
  useEffect(() => {
    if (!socket) return
    socket.connect()
  }, [socket])

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
    socket.on("previewURL", handlePreviewURL)

    return () => {
      socket.off("connect", onConnect)
      socket.off("disconnect", onDisconnect)
      socket.off("error", onError)
      socket.off("previewURL", handlePreviewURL)
    }
  }, [socket, handlePreviewURL])

  return {
    socket,
  }
}
