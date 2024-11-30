import { useSocket } from "@/context/SocketContext"
import { TFile } from "@/lib/types"
import { X, ChevronDown } from "lucide-react"
import { nanoid } from "nanoid"
import { useEffect, useRef, useState } from "react"
import LoadingDots from "../../ui/LoadingDots"
import ChatInput from "./ChatInput"
import ChatMessage from "./ChatMessage"
import ContextTabs from "./ContextTabs"
import { handleSend, handleStopGeneration } from "./lib/chatUtils"
import { AIChatProps, ContextTab, Message } from "./types"

export default function AIChat({
  activeFileContent,
  activeFileName,
  onClose,
  editorRef,
  lastCopiedRangeRef,
  files,
  templateType,
}: AIChatProps) {
  // Initialize socket and messages
  const { socket } = useSocket()
  const [messages, setMessages] = useState<Message[]>([])

  // Initialize input and state for generating messages
  const [input, setInput] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)

  // Initialize chat container ref and abort controller ref
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Initialize context tabs and state for expanding context
  const [contextTabs, setContextTabs] = useState<ContextTab[]>([])
  const [isContextExpanded, setIsContextExpanded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Initialize textarea ref
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // state variables for auto scroll and scroll button
  const [autoScroll, setAutoScroll] = useState(true)
  const [showScrollButton, setShowScrollButton] = useState(false)

  // scroll to bottom of chat when messages change
  useEffect(() => {
    if (autoScroll) {
      scrollToBottom()
    }
  }, [messages, autoScroll])

  // scroll to bottom of chat when messages change
  const scrollToBottom = (force: boolean = false) => {
    if (!chatContainerRef.current || (!autoScroll && !force)) return

    chatContainerRef.current.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: force ? "smooth" : "auto",
    })
  }

  // function to handle scroll events
  const handleScroll = () => {
    if (!chatContainerRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current
    const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 50

    setAutoScroll(isAtBottom)
    setShowScrollButton(!isAtBottom)
  }

  // scroll event listener
  useEffect(() => {
    const container = chatContainerRef.current
    if (container) {
      container.addEventListener("scroll", handleScroll)
      return () => container.removeEventListener("scroll", handleScroll)
    }
  }, [])

  // Add context tab to context tabs
  const addContextTab = (
    type: string,
    name: string,
    content: string,
    lineRange?: { start: number; end: number }
  ) => {
    const newTab = {
      id: nanoid(),
      type: type as "file" | "code" | "image",
      name,
      content,
      lineRange,
    }
    setContextTabs((prev) => [...prev, newTab])
  }

  // Remove context tab from context tabs
  const removeContextTab = (id: string) => {
    setContextTabs((prev) => prev.filter((tab) => tab.id !== id))
  }

  // Add file to context tabs
  const handleAddFile = (tab: ContextTab) => {
    setContextTabs((prev) => [...prev, tab])
  }

  // Format code content to remove starting and ending code block markers if they exist
  const formatCodeContent = (content: string) => {
    return content.replace(/^```[\w-]*\n/, "").replace(/\n```$/, "")
  }

  // Get combined context from context tabs
  const getCombinedContext = () => {
    if (contextTabs.length === 0) return ""

    return contextTabs
      .map((tab) => {
        if (tab.type === "file") {
          const fileExt = tab.name.split(".").pop() || "txt"
          const cleanContent = formatCodeContent(tab.content)
          return `File ${tab.name}:\n\`\`\`${fileExt}\n${cleanContent}\n\`\`\``
        } else if (tab.type === "code") {
          const cleanContent = formatCodeContent(tab.content)
          return `Code from ${tab.name}:\n\`\`\`typescript\n${cleanContent}\n\`\`\``
        } else if (tab.type === "image") {
          return `Image ${tab.name}:\n${tab.content}`
        }
        return `${tab.name}:\n${tab.content}`
      })
      .join("\n\n")
  }

  // Handle sending message with context
  const handleSendWithContext = () => {
    const combinedContext = getCombinedContext()
    handleSend(
      input,
      combinedContext,
      messages,
      setMessages,
      setInput,
      setIsContextExpanded,
      setIsGenerating,
      setIsLoading,
      abortControllerRef,
      activeFileContent,
      false,
      templateType
    )
    // Clear context tabs after sending
    setContextTabs([])
  }

  // Set context for the chat
  const setContext = (
    context: string | null,
    name: string,
    range?: { start: number; end: number }
  ) => {
    if (!context) {
      setContextTabs([])
      return
    }

    // Always add a new tab instead of updating existing ones
    addContextTab("code", name, context, range)
  }

  return (
    <div className="flex flex-col h-screen w-full">
      <div className="flex justify-between items-center p-2 border-b">
        <span className="text-muted-foreground/50 font-medium">CHAT</span>
        <div className="flex items-center h-full">
          <span className="text-muted-foreground/50 font-medium">
            {activeFileName}
          </span>
          <div className="mx-2 h-full w-px bg-muted-foreground/20"></div>
          <button
            onClick={onClose}
            className="text-muted-foreground/50 hover:text-muted-foreground focus:outline-none"
            aria-label="Close AI Chat"
          >
            <X size={18} />
          </button>
        </div>
      </div>
      <div
        ref={chatContainerRef}
        className="flex-grow overflow-y-auto p-4 space-y-4 relative"
      >
        {messages.map((message, messageIndex) => (
          // Render chat message component for each message
          <ChatMessage
            key={messageIndex}
            message={message}
            setContext={setContext}
            setIsContextExpanded={setIsContextExpanded}
            socket={socket}
          />
        ))}
        {isLoading && <LoadingDots />}

        {/* Add scroll to bottom button */}
        {showScrollButton && (
          <button
            onClick={() => scrollToBottom(true)}
            className="fixed bottom-36 right-6 bg-primary text-primary-foreground rounded-md border border-primary p-0.5 shadow-lg hover:bg-primary/90 transition-all"
            aria-label="Scroll to bottom"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        )}
      </div>
      <div className="p-4 border-t mb-14">
        {/* Render context tabs component */}
        <ContextTabs
          activeFileName={activeFileName}
          onAddFile={handleAddFile}
          contextTabs={contextTabs}
          onRemoveTab={removeContextTab}
          isExpanded={isContextExpanded}
          onToggleExpand={() => setIsContextExpanded(!isContextExpanded)}
          files={files}
          socket={socket}
          onFileSelect={(file: TFile) => {
            socket?.emit("getFile", { fileId: file.id }, (response: string) => {
              const fileExt = file.name.split(".").pop() || "txt"
              const formattedContent = `\`\`\`${fileExt}\n${response}\n\`\`\``
              addContextTab("file", file.name, formattedContent)
              if (textareaRef.current) {
                textareaRef.current.focus()
              }
            })
          }}
        />
        {/* Render chat input component */}
        <ChatInput
          textareaRef={textareaRef}
          addContextTab={addContextTab}
          editorRef={editorRef}
          input={input}
          setInput={setInput}
          isGenerating={isGenerating}
          handleSend={handleSendWithContext}
          handleStopGeneration={() => handleStopGeneration(abortControllerRef)}
          onImageUpload={(file) => {
            const reader = new FileReader()
            reader.onload = (e) => {
              if (e.target?.result) {
                addContextTab("image", file.name, e.target.result as string)
              }
            }
            reader.readAsDataURL(file)
          }}
          lastCopiedRangeRef={lastCopiedRangeRef}
          activeFileName={activeFileName}
          contextTabs={contextTabs.map((tab) => ({
            ...tab,
            title: tab.id,
          }))}
          onRemoveTab={removeContextTab}
        />
      </div>
    </div>
  )
}
