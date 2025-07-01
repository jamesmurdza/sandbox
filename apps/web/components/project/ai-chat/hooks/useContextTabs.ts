import { useEffect, useState } from "react"
import { ContextTab } from "../lib/types"

/**
 * Custom hook for managing context tabs
 * Handles adding, removing, and updating context tabs
 */
export function useContextTabs(
  activeFileName: string,
  activeFileContent: string
) {
  const [contextTabs, setContextTabs] = useState<ContextTab[]>([])
  const [isContextExpanded, setIsContextExpanded] = useState(false)

  /**
   * Update context tabs when active file content changes
   */
  useEffect(() => {
    setContextTabs((prevTabs) =>
      prevTabs.map((tab) => {
        if (tab.type === "file" && tab.name === activeFileName) {
          const fileExt = tab.name.split(".").pop() || "txt"
          return {
            ...tab,
            content: `\`\`\`${fileExt}\n${activeFileContent}\n\`\`\``,
          }
        }
        return tab
      })
    )
  }, [activeFileContent, activeFileName])

  /**
   * Set context for the chat
   */
  const setContext = (
    context: string | null,
    name: string,
    range?: { start: number; end: number }
  ) => {
    if (!context) {
      setContextTabs([])
      return
    }

    // Add a new context tab
    const newTab: ContextTab = {
      id: `context-${Date.now()}`,
      type: "code",
      name,
      content: context,
      lineRange: range,
    }
    setContextTabs((prev) => [...prev, newTab])
  }

  return {
    contextTabs,
    setContextTabs,
    isContextExpanded,
    setIsContextExpanded,
    setContext,
  }
}
