import { useTerminal } from "@/context/TerminalContext"
import { useCallback } from "react"

export interface UseSocketHandlersProps {
  loadPreviewURL: (url: string) => void
}

export interface UseSocketHandlersReturn {
  socketHandlers: {
    onTerminalResponse: (response: { id: string; data: string }) => void
    onPreviewURL: (url: string) => void
  }
}

/**
 * Hook for managing socket event handlers with proper dependency injection
 */
export function useSocketHandlers({
  loadPreviewURL,
}: UseSocketHandlersProps): UseSocketHandlersReturn {
  const { terminals } = useTerminal()

  // Handle terminal responses from socket
  const handleTerminalResponse = useCallback(
    (response: { id: string; data: string }) => {
      const term = terminals.find((t) => t.id === response.id)
      if (term && term.terminal) {
        term.terminal.write(response.data)
      }
    },
    [terminals]
  )

  // Handle preview URL updates from socket
  const handlePreviewURL = useCallback(
    (url: string) => {
      loadPreviewURL(url)
    },
    [loadPreviewURL]
  )

  const socketHandlers = {
    onTerminalResponse: handleTerminalResponse,
    onPreviewURL: handlePreviewURL,
  }

  return {
    socketHandlers,
  }
}
