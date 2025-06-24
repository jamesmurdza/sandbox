import { useAppStore } from "@/store/context"
import { useParams } from "next/navigation"
import { useEffect } from "react"
import { useFileTree } from "./useFile"

/**
 * Hook for handling editor keyboard shortcuts and browser events
 */
export function useEditorShortcuts() {
  const { id: projectId } = useParams<{ id: string }>()
  const { id: activeFileId } = useAppStore((s) => s.activeTab) ?? {}
  const hasUnsavedFiles = useAppStore((s) => s.tabs.some((tab) => !tab.saved))
  const draft = useAppStore((s) => s.drafts[activeFileId ?? ""])
  const { saveFile } = useFileTree()

  // TODO: SOLVE THE CHAT UI
  const toggleAIChat = () => {}
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
      if (e.key === "s" && (e.metaKey || e.ctrlKey) && activeFileId && draft) {
        e.preventDefault()
        saveFile({
          fileId: activeFileId,
          projectId,
          content: draft,
        })
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
