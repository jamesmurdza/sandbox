import { useCallback, useEffect, useRef, useState } from "react"
import { ImperativePanelHandle } from "react-resizable-panels"

export interface UseEditorLayoutProps {
  previewWindowRef: React.RefObject<{ refreshIframe: () => void }>
}

export interface UseEditorLayoutReturn {
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
  setIsAIChatOpen: React.Dispatch<React.SetStateAction<boolean>>
  setIsPreviewCollapsed: React.Dispatch<React.SetStateAction<boolean>>
}

export function useEditorLayout(): UseEditorLayoutReturn {
  // Layout state
  const [isHorizontalLayout, setIsHorizontalLayout] = useState(false)
  const [previousLayout, setPreviousLayout] = useState(false)
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(true)
  const [isAIChatOpen, setIsAIChatOpen] = useState(false)

  // Preview state
  const [previewURL, setPreviewURL] = useState<string>("")

  // Get preview panel ref from context
  // Note: We'll need to update this to work with the existing PreviewContext
  const previewPanelRef = useRef<ImperativePanelHandle>(null)

  // Load preview URL with refresh
  const loadPreviewURL = useCallback((url: string) => {
    setPreviewURL(url)
  }, [])

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

  // Toggle layout between horizontal and vertical
  const toggleLayout = useCallback(() => {
    if (!isAIChatOpen) {
      setIsHorizontalLayout((prev) => !prev)
    }
  }, [isAIChatOpen])

  // Toggle AI chat
  const toggleAIChat = useCallback(() => {
    setIsAIChatOpen((prev) => !prev)
  }, [])

  // Effect to handle layout changes when AI chat is opened/closed
  useEffect(() => {
    if (isAIChatOpen) {
      setPreviousLayout(isHorizontalLayout)
      setIsHorizontalLayout(true)
    } else {
      setIsHorizontalLayout(previousLayout)
    }
  }, [isAIChatOpen, isHorizontalLayout, previousLayout])

  return {
    // Layout state
    isHorizontalLayout,
    isPreviewCollapsed,
    isAIChatOpen,
    previewURL,

    // Layout actions
    togglePreviewPanel,
    toggleLayout,
    toggleAIChat,
    loadPreviewURL,

    // State setters for external updates
    setIsAIChatOpen,
    setIsPreviewCollapsed,
  }
}
