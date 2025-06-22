import { AlertState } from "@/components/editor/changes-alert"
import { useSocket } from "@/context/SocketContext"
import { TTab } from "@/lib/types"
import { debounce, processFileType } from "@/lib/utils"
import { apiClient } from "@/server/client"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

export interface UseFileManagerProps {
  setShowAlert: (state: AlertState) => void
}

export interface UseFileManagerReturn {
  // State
  tabs: TTab[]
  activeFileId: string
  activeFileContent: string
  fileContents: Record<string, string>
  editorLanguage: string
  hasUnsavedFiles: boolean

  // Actions
  selectFile: (tab: TTab) => void
  prefetchFile: (tab: TTab) => void
  closeTab: (id: string) => void
  closeTabs: (ids: string[]) => void
  saveFile: (fileId?: string) => void
  updateActiveFileContent: (content: string) => void

  // Internal for external dependencies
  setActiveFileId: (id: string) => void
  setActiveFileContent: (content: string) => void
  setTabs: React.Dispatch<React.SetStateAction<TTab[]>>
  setEditorLanguage: (language: string) => void
}

export const useFileManager = (): UseFileManagerReturn => {
  // File state
  const { id: projectId } = useParams<{ id: string }>()
  const { socket } = useSocket()
  const [tabs, setTabs] = useState<TTab[]>([])
  const [activeFileId, setActiveFileId] = useState<string>("")
  const [activeFileContent, setActiveFileContent] = useState("")
  const [fileContents, setFileContents] = useState<Record<string, string>>({})
  const [editorLanguage, setEditorLanguage] = useState("plaintext")

  // Cache for file operations
  const fileCache = useRef(new Map())

  // Computed values
  const hasUnsavedFiles = tabs.some((tab) => !tab.saved)

  const debouncedGetFile = (
    tabId: string,
    callback: (content: string) => void
  ) => {
    apiClient.file
      .$get({
        query: {
          fileId: tabId,
          projectId,
        },
      })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json()

          callback(data.data ?? "")
        }
      })
  } // 300ms debounce delay, adjust as needed

  // Function to save the file content after a debounce period
  const debouncedSaveData = useCallback(
    debounce((activeFileId: string | undefined) => {
      if (activeFileId) {
        // Get the current content of the file
        const content = fileContents[activeFileId]

        // Mark the file as saved in the tabs
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === activeFileId ? { ...tab, saved: true } : tab
          )
        )
        socket?.emit("saveFile", { fileId: activeFileId, body: content })
      }
    }, Number(process.env.NEXT_PUBLIC_FILE_SAVE_DEBOUNCE_DELAY) || 1000),
    [socket, fileContents]
  )

  // Manual save function
  const saveFile = useCallback(
    (fileId?: string) => {
      const targetFileId = fileId || activeFileId
      if (targetFileId) {
        debouncedSaveData(targetFileId)
      }
    },
    [activeFileId, debouncedSaveData]
  )

  // Select file function
  const selectFile = useCallback(
    (tab: TTab) => {
      if (tab.id === activeFileId) return

      // TODO: Handle generate state if needed
      // setGenerate((prev) => ({ ...prev, show: false }))

      // Normalize the file path and name for comparison
      const normalizedId = tab.id.replace(/^\/+/, "") // Remove leading slashes
      const fileName = tab.name.split("/").pop() || ""

      // Check if the tab already exists in the list of open tabs
      const existingTab = tabs.find((t) => {
        const normalizedTabId = t.id.replace(/^\/+/, "")
        const tabFileName = t.name.split("/").pop() || ""
        return normalizedTabId === normalizedId || tabFileName === fileName
      })

      if (existingTab) {
        // If the tab exists, just make it active
        setActiveFileId(existingTab.id)
        setEditorLanguage(processFileType(existingTab.name))
        // Only set content if it exists in fileContents
        if (fileContents[existingTab.id] !== undefined) {
          setActiveFileContent(fileContents[existingTab.id])
        }
      } else {
        // If the tab doesn't exist, add it to the list and make it active
        setTabs((prev) => [...prev, tab])

        // For new files, set empty content
        if (tab.id.includes("(new file)")) {
          setFileContents((prev) => ({ ...prev, [tab.id]: "" }))
          setActiveFileContent("")
          setActiveFileId(tab.id)
          setEditorLanguage(processFileType(tab.name))
        } else {
          // Fetch content if not cached
          if (!fileContents[tab.id]) {
            debouncedGetFile(tab.id, (response: string) => {
              setActiveFileId(tab.id)
              setFileContents((prev) => ({ ...prev, [tab.id]: response }))
              setActiveFileContent(response)
              setEditorLanguage(processFileType(tab.name))
            })
          } else {
            setActiveFileId(tab.id)
            setActiveFileContent(fileContents[tab.id])
            setEditorLanguage(processFileType(tab.name))
          }
        }
      }
    },
    [activeFileId, tabs, fileContents, debouncedGetFile]
  )

  // Prefetch file function
  const prefetchFile = useCallback(
    (tab: TTab) => {
      if (fileContents[tab.id]) return
      debouncedGetFile(tab.id, (response: string) => {
        setFileContents((prev) => ({ ...prev, [tab.id]: response }))
      })
    },
    [fileContents, debouncedGetFile]
  )

  // Close tab function
  const closeTab = useCallback(
    (id: string) => {
      const numTabs = tabs.length
      const index = tabs.findIndex((t) => t.id === id)

      console.log("closing tab", id, index)

      if (index === -1) return
      const selectedTab = tabs[index]
      // check if the tab has unsaved changes
      if (selectedTab && !selectedTab.saved) {
        // Show a confirmation dialog to the user
        // setShowAlert({ type: "tab", id })
        return
      }
      const nextId =
        activeFileId === id
          ? numTabs === 1
            ? null
            : index < numTabs - 1
            ? tabs[index + 1].id
            : tabs[index - 1].id
          : activeFileId

      setTabs((prev) => prev.filter((t) => t.id !== id))

      if (!nextId) {
        setActiveFileId("")
      } else {
        const nextTab = tabs.find((t) => t.id === nextId)
        if (nextTab) {
          selectFile(nextTab)
        }
      }
    },
    [tabs, activeFileId, selectFile]
  )

  // Close multiple tabs function
  const closeTabs = useCallback(
    (ids: string[]) => {
      const numTabs = tabs.length

      if (numTabs === 0) return

      const allIndexes = ids.map((id) => tabs.findIndex((t) => t.id === id))
      const indexes = allIndexes.filter((index) => index !== -1)
      if (indexes.length === 0) return

      console.log("closing tabs", ids, indexes)

      const activeIndex = tabs.findIndex((t) => t.id === activeFileId)
      const newTabs = tabs.filter((t) => !ids.includes(t.id))
      setTabs(newTabs)

      if (indexes.length === numTabs) {
        setActiveFileId("")
      } else {
        const nextTab =
          newTabs.length > activeIndex
            ? newTabs[activeIndex]
            : newTabs[newTabs.length - 1]
        if (nextTab) {
          selectFile(nextTab)
        }
      }
    },
    [tabs, activeFileId, selectFile]
  )

  // Update active file content function
  const updateActiveFileContent = useCallback(
    (content: string) => {
      setActiveFileContent(content)

      if (activeFileId) {
        // Update file contents cache
        setFileContents((prev) => ({
          ...prev,
          [activeFileId]: content,
        }))

        // Update tab saved status
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === activeFileId
              ? { ...tab, saved: fileContents[activeFileId] === content }
              : tab
          )
        )
      }
    },
    [activeFileId, fileContents]
  )

  // Effect to update fileContents when the editor content changes
  useEffect(() => {
    if (activeFileId) {
      // Cache the current active file content using the file ID as the key
      setFileContents((prev) => ({
        ...prev,
        [activeFileId]: activeFileContent,
      }))
    }
  }, [activeFileContent, activeFileId])

  return {
    // State
    tabs,
    activeFileId,
    activeFileContent,
    fileContents,
    editorLanguage,
    hasUnsavedFiles,

    // Actions
    selectFile,
    prefetchFile,
    closeTab,
    closeTabs,
    saveFile,
    updateActiveFileContent,

    // Internal for external dependencies
    setActiveFileId,
    setActiveFileContent,
    setTabs,
    setEditorLanguage,
  }
}
