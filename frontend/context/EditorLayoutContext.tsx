"use client"

import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { ImperativePanelHandle } from "react-resizable-panels"

interface EditorLayoutContextValue {
  // Layout state
  isHorizontalLayout: boolean
  isPreviewCollapsed: boolean
  isAIChatOpen: boolean
  previewURL: string

  // Layout actions
  togglePreviewPanel: () => void
  toggleLayout: () => void
  toggleAIChat: () => void
  loadPreviewURL: (url: string) => void

  // Exposed setters
  setIsAIChatOpen: React.Dispatch<React.SetStateAction<boolean>>
  setIsPreviewCollapsed: React.Dispatch<React.SetStateAction<boolean>>

  // Refs
  previewPanelRef: React.RefObject<ImperativePanelHandle>
}

const EditorLayoutContext = createContext<EditorLayoutContextValue | null>(null)

export function EditorLayoutProvider({ children }: { children: ReactNode }) {
  // Layout state
  const [isHorizontalLayout, setIsHorizontalLayout] = useState(false)
  const [previousLayout, setPreviousLayout] = useState(false)
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(true)
  const [isAIChatOpen, setIsAIChatOpen] = useState(false)

  // Preview state
  const [previewURL, setPreviewURL] = useState("")

  // Panel ref
  const previewPanelRef = useRef<ImperativePanelHandle>(null)

  // Toggle preview panel
  const togglePreviewPanel = useCallback(() => {
    if (isPreviewCollapsed) {
      previewPanelRef.current?.expand()
      setIsPreviewCollapsed(false)
    } else {
      previewPanelRef.current?.collapse()
      setIsPreviewCollapsed(true)
    }
  }, [isPreviewCollapsed])

  // Toggle layout
  const toggleLayout = useCallback(() => {
    if (!isAIChatOpen) {
      setIsHorizontalLayout((prev) => !prev)
    }
  }, [isAIChatOpen])

  // Toggle AI chat
  const toggleAIChat = useCallback(() => {
    setIsAIChatOpen((prev) => !prev)
  }, [])

  // Layout reaction to AI chat state
  useEffect(() => {
    if (isAIChatOpen) {
      setPreviousLayout(isHorizontalLayout)
      setIsHorizontalLayout(true)
    } else {
      setIsHorizontalLayout(previousLayout)
    }
  }, [isAIChatOpen, isHorizontalLayout, previousLayout])

  // Load preview URL
  const loadPreviewURL = useCallback((url: string) => {
    setPreviewURL(url)
  }, [])

  return (
    <EditorLayoutContext.Provider
      value={{
        isHorizontalLayout,
        isPreviewCollapsed,
        isAIChatOpen,
        previewURL,
        togglePreviewPanel,
        toggleLayout,
        toggleAIChat,
        loadPreviewURL,
        setIsAIChatOpen,
        setIsPreviewCollapsed,
        previewPanelRef,
      }}
    >
      {children}
    </EditorLayoutContext.Provider>
  )
}

export const useEditorLayout = () => {
  const ctx = useContext(EditorLayoutContext)
  if (!ctx) {
    throw new Error("useEditorLayout must be used within EditorLayoutProvider")
  }
  return ctx
}
