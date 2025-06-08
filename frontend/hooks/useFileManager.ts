import { AlertState } from "@/components/editor/changes-alert"
import { TFile, TFolder, TTab } from "@/lib/types"
import { debounce, processFileType, validateName } from "@/lib/utils"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

export interface UseFileManagerProps {
  socket: any
  setGenerate: (fn: (prev: any) => any) => void
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
  handleRename: (
    id: string,
    newName: string,
    oldName: string,
    type: "file" | "folder"
  ) => boolean
  handleDeleteFile: (file: TFile) => void
  handleDeleteFolder: (folder: TFolder) => void
  saveFile: (fileId?: string) => void
  updateActiveFileContent: (content: string) => void

  // Internal for external dependencies
  setActiveFileId: (id: string) => void
  setActiveFileContent: (content: string) => void
  setTabs: React.Dispatch<React.SetStateAction<TTab[]>>
  setEditorLanguage: (language: string) => void
  setDeletingFolderId: (id: string) => void
}

export const useFileManager = ({
  socket,
  setGenerate,
  setShowAlert,
}: UseFileManagerProps): UseFileManagerReturn => {
  // File state
  const [tabs, setTabs] = useState<TTab[]>([])
  const [activeFileId, setActiveFileId] = useState<string>("")
  const [activeFileContent, setActiveFileContent] = useState("")
  const [fileContents, setFileContents] = useState<Record<string, string>>({})
  const [editorLanguage, setEditorLanguage] = useState("plaintext")
  const [deletingFolderId, setDeletingFolderId] = useState("")

  // Cache for file operations
  const fileCache = useRef(new Map())

  // Computed values
  const hasUnsavedFiles = tabs.some((tab) => !tab.saved)

  // Debounced function to get file content
  const debouncedGetFile = useCallback(
    (tabId: string, callback: (content: string) => void) => {
      socket?.emit("getFile", { fileId: tabId }, callback)
    },
    [socket]
  )

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

      setGenerate((prev) => ({ ...prev, show: false }))

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
    [activeFileId, tabs, fileContents, setGenerate, debouncedGetFile]
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
        setShowAlert({ type: "tab", id })
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
    [tabs, activeFileId, setShowAlert, selectFile]
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

  // Handle rename function
  const handleRename = useCallback(
    (
      id: string,
      newName: string,
      oldName: string,
      type: "file" | "folder"
    ): boolean => {
      const valid = validateName(newName, oldName, type)
      if (!valid.status) {
        if (valid.message) toast.error("Invalid file name.")
        return false
      }

      socket?.emit("renameFile", { fileId: id, newName })
      setTabs((prev) =>
        prev.map((tab) => (tab.id === id ? { ...tab, name: newName } : tab))
      )

      return true
    },
    [socket]
  )

  // Handle delete file function
  const handleDeleteFile = useCallback(
    (file: TFile) => {
      socket?.emit("deleteFile", { fileId: file.id })
      closeTab(file.id)
    },
    [socket, closeTab]
  )

  // Handle delete folder function
  const handleDeleteFolder = useCallback(
    (folder: TFolder) => {
      setDeletingFolderId(folder.id)
      console.log("deleting folder", folder.id)

      socket?.emit("getFolder", { folderId: folder.id }, (response: string[]) =>
        closeTabs(response)
      )

      socket?.emit(
        "deleteFolder",
        { folderId: folder.id },
        (response: (TFolder | TFile)[]) => {
          setDeletingFolderId("")
        }
      )
    },
    [socket, closeTabs]
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
    handleRename,
    handleDeleteFile,
    handleDeleteFolder,
    saveFile,
    updateActiveFileContent,

    // Internal for external dependencies
    setActiveFileId,
    setActiveFileContent,
    setTabs,
    setEditorLanguage,
    setDeletingFolderId,
  }
}
