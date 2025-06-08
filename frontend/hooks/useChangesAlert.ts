import { AlertState } from "@/components/editor/changes-alert"
import { TTab } from "@/lib/types"
import { useCallback } from "react"

export interface UseChangesAlertProps {
  tabs: TTab[]
  activeFileId: string
  setTabs: React.Dispatch<React.SetStateAction<TTab[]>>
  setActiveFileId: (id: string) => void
  selectFile: (tab: TTab) => void
}

export interface UseChangesAlertReturn {
  handleAlertAccept: (showAlert: AlertState) => void
}

/**
 * Hook for handling changes alert logic and tab management
 */
export function useChangesAlert({
  tabs,
  activeFileId,
  setTabs,
  setActiveFileId,
  selectFile,
}: UseChangesAlertProps): UseChangesAlertReturn {
  const handleAlertAccept = useCallback(
    (showAlert: AlertState) => {
      if (!showAlert) return

      const { id } = showAlert
      const numTabs = tabs.length

      // Find the index of the tab to be closed
      const index = tabs.findIndex((t) => t.id === id)

      // Determine the next tab to select
      const nextId =
        activeFileId === id
          ? numTabs === 1
            ? null // No tabs left
            : index < numTabs - 1
            ? tabs[index + 1].id // Select next tab
            : tabs[index - 1].id // Select previous tab
          : activeFileId // Keep current active file

      // Remove the tab from the list
      setTabs((prev) => prev.filter((t) => t.id !== id))

      // Update active file
      if (!nextId) {
        setActiveFileId("")
      } else {
        const nextTab = tabs.find((t) => t.id === nextId)
        if (nextTab) {
          selectFile(nextTab)
        }
      }
    },
    [tabs, activeFileId, setTabs, setActiveFileId, selectFile]
  )

  return {
    handleAlertAccept,
  }
}
