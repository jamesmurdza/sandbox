import { useEffect } from "react"

export interface UseEditorShortcutsProps {
  hasUnsavedFiles: boolean
  activeFileId: string
  saveFile: (fileId: string) => void
  toggleAIChat: () => void
}

export interface UseEditorShortcutsReturn {
  // This hook handles effects internally, no return values needed
}

/**
 * Hook for handling editor keyboard shortcuts and browser events
 */
export function useEditorShortcuts({
  hasUnsavedFiles,
  activeFileId,
  saveFile,
  toggleAIChat,
}: UseEditorShortcutsProps): UseEditorShortcutsReturn {
  // Handle browser beforeunload event for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedFiles) {
        e.preventDefault()
        e.returnValue =
          "You have unsaved changes. Are you sure you want to leave?"
        return e.returnValue
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [hasUnsavedFiles])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S: Save file
      if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        saveFile(activeFileId)
      }
      // Ctrl+L or Cmd+L: Toggle AI chat
      else if (e.key === "l" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        toggleAIChat()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [activeFileId, saveFile, toggleAIChat])

  return {}
}
