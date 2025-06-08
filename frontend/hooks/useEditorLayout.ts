import { Terminal } from "@xterm/xterm"
import { useCallback, useEffect, useRef, useState } from "react"
import { ImperativePanelHandle } from "react-resizable-panels"

export interface UseEditorLayoutProps {
  isOwner: boolean
}

export interface UseEditorLayoutReturn {
  // Layout state
  isHorizontalLayout: boolean
  isPreviewCollapsed: boolean
  isAIChatOpen: boolean
  previewURL: string

  // Access control state
  disableAccess: {
    isDisabled: boolean
    message: string
  }

  // Terminal state
  terminals: { id: string; terminal: Terminal | null }[]

  // Layout refs
  editorContainerRef: React.RefObject<HTMLDivElement>
  editorPanelRef: React.RefObject<ImperativePanelHandle>
  previewWindowRef: React.RefObject<{ refreshIframe: () => void }>

  // Layout actions
  togglePreviewPanel: () => void
  toggleLayout: () => void
  toggleAIChat: () => void
  loadPreviewURL: (url: string) => void

  // State setters for external updates
  setDisableAccess: React.Dispatch<
    React.SetStateAction<{
      isDisabled: boolean
      message: string
    }>
  >
  setTerminals: React.Dispatch<
    React.SetStateAction<
      {
        id: string
        terminal: Terminal | null
      }[]
    >
  >
  setIsAIChatOpen: React.Dispatch<React.SetStateAction<boolean>>
  setIsPreviewCollapsed: React.Dispatch<React.SetStateAction<boolean>>
}

export function useEditorLayout({
  isOwner,
}: UseEditorLayoutProps): UseEditorLayoutReturn {
  // Layout state
  const [isHorizontalLayout, setIsHorizontalLayout] = useState(false)
  const [previousLayout, setPreviousLayout] = useState(false)
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(true)
  const [isAIChatOpen, setIsAIChatOpen] = useState(false)

  // Preview state
  const [previewURL, setPreviewURL] = useState<string>("")

  // Access control state
  const [disableAccess, setDisableAccess] = useState({
    isDisabled: false,
    message: "",
  })

  // Terminal state
  const [terminals, setTerminals] = useState<
    { id: string; terminal: Terminal | null }[]
  >([])

  // Layout refs
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const editorPanelRef = useRef<ImperativePanelHandle>(null)
  const previewWindowRef = useRef<{ refreshIframe: () => void }>(null)

  // Get preview panel ref from context
  // Note: We'll need to update this to work with the existing PreviewContext
  const previewPanelRef = useRef<ImperativePanelHandle>(null)

  // Load preview URL with refresh
  const loadPreviewURL = useCallback((url: string) => {
    setPreviewURL(url)
    previewWindowRef.current?.refreshIframe()
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

    // Access control state
    disableAccess,

    // Terminal state
    terminals,

    // Layout refs
    editorContainerRef,
    editorPanelRef,
    previewWindowRef,

    // Layout actions
    togglePreviewPanel,
    toggleLayout,
    toggleAIChat,
    loadPreviewURL,

    // State setters for external updates
    setDisableAccess,
    setTerminals,
    setIsAIChatOpen,
    setIsPreviewCollapsed,
  }
}
