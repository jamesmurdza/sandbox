import { TFile, TFolder } from "@/lib/types"
import { Terminal } from "@xterm/xterm"
import { useCallback } from "react"

export interface UseSocketHandlersProps {
  isOwner: boolean
  terminals: { id: string; terminal: Terminal | null }[]
  setFiles: React.Dispatch<React.SetStateAction<(TFolder | TFile)[]>>
  setDisableAccess: React.Dispatch<
    React.SetStateAction<{
      isDisabled: boolean
      message: string
    }>
  >
  loadPreviewURL: (url: string) => void
}

export interface UseSocketHandlersReturn {
  socketHandlers: {
    onFileLoaded: (files: (TFolder | TFile)[]) => void
    onTerminalResponse: (response: { id: string; data: string }) => void
    onDisableAccess: (message: string) => void
    onPreviewURL: (url: string) => void
  }
}

/**
 * Hook for managing socket event handlers with proper dependency injection
 */
export function useSocketHandlers({
  isOwner,
  terminals,
  setFiles,
  setDisableAccess,
  loadPreviewURL,
}: UseSocketHandlersProps): UseSocketHandlersReturn {
  // Handle file loading from socket
  const handleFileLoaded = useCallback(
    (files: (TFolder | TFile)[]) => {
      setFiles(files)
    },
    [setFiles]
  )

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

  // Handle access control from socket
  const handleDisableAccess = useCallback(
    (message: string) => {
      if (!isOwner) {
        setDisableAccess({
          isDisabled: true,
          message,
        })
      }
    },
    [isOwner, setDisableAccess]
  )

  // Handle preview URL updates from socket
  const handlePreviewURL = useCallback(
    (url: string) => {
      loadPreviewURL(url)
    },
    [loadPreviewURL]
  )

  const socketHandlers = {
    onFileLoaded: handleFileLoaded,
    onTerminalResponse: handleTerminalResponse,
    onDisableAccess: handleDisableAccess,
    onPreviewURL: handlePreviewURL,
  }

  return {
    socketHandlers,
  }
}
