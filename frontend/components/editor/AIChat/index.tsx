import { X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import LoadingDots from "../../ui/LoadingDots"
import ChatInput from "./ChatInput"
import ChatMessage from "./ChatMessage"
import ContextTabs from "./ContextTabs"
import { handleSend, handleStopGeneration } from "./lib/chatUtils"
import { nanoid } from 'nanoid'
import * as monaco from 'monaco-editor'
import { TFile, TFolder } from "@/lib/types"
import { useSocket } from "@/context/SocketContext"

interface Message {
  role: "user" | "assistant"
  content: string
  context?: string
}

interface ContextTab {
  id: string
  type: "file" | "code" | "image"
  name: string
  content: string
  lineRange?: { start: number; end: number }
}

interface AIChatProps {
  activeFileContent: string
  activeFileName: string
  onClose: () => void
  editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | undefined>
  lastCopiedRangeRef: React.MutableRefObject<{ startLine: number; endLine: number } | null>
  files: (TFile | TFolder)[]
}

export default function AIChat({
  activeFileContent,
  activeFileName,
  onClose,
  editorRef,
  lastCopiedRangeRef,
  files,
}: AIChatProps) {
  const { socket } = useSocket()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const [contextTabs, setContextTabs] = useState<ContextTab[]>([])
  const [isContextExpanded, setIsContextExpanded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      setTimeout(() => {
        chatContainerRef.current?.scrollTo({
          top: chatContainerRef.current.scrollHeight,
          behavior: "smooth",
        })
      }, 100)
    }
  }

  const addContextTab = (type: string, name: string, content: string, lineRange?: { start: number; end: number }) => {
    const newTab = {
      id: nanoid(),
      type: type as "file" | "code" | "image",
      name,
      content,
      lineRange
    }
    setContextTabs(prev => [...prev, newTab])
  }

  const removeContextTab = (id: string) => {
    setContextTabs(prev => prev.filter(tab => tab.id !== id))
  }

  const handleAddFile = () => {
    console.log("Add file to context")
  }

  const formatCodeContent = (content: string) => {
    // Remove starting and ending code block markers if they exist
    return content.replace(/^```[\w-]*\n/, '').replace(/\n```$/, '')
  }

  const getCombinedContext = () => {
    if (contextTabs.length === 0) return ''
    
    return contextTabs.map(tab => {
      if (tab.type === 'file') {
        const fileExt = tab.name.split('.').pop() || 'txt'
        const cleanContent = formatCodeContent(tab.content)
        return `File ${tab.name}:\n\`\`\`${fileExt}\n${cleanContent}\n\`\`\``
      } else if (tab.type === 'code') {
        const cleanContent = formatCodeContent(tab.content)
        return `Code from ${tab.name}:\n\`\`\`typescript\n${cleanContent}\n\`\`\``
      }
      return `${tab.name}:\n${tab.content}`
    }).join('\n\n')
  }

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
      activeFileContent
    )
    // Clear context tabs after sending
    setContextTabs([])
  }

  function setContext(context: string | null, fileName?: string, lineRange?: { start: number; end: number }): void {
    if (!context) {
      setContextTabs([])
      return
    }

    const existingCodeTab = contextTabs.find(tab => tab.type === 'code')
    
    if (existingCodeTab) {
      setContextTabs(prev => 
        prev.map(tab => 
          tab.id === existingCodeTab.id 
            ? { ...tab, content: context, name: fileName || 'Code Context', lineRange }
            : tab
        )
      )
    } else {
      addContextTab('code', fileName || 'Chat Context', context, lineRange)
    }
  }

  useEffect(() => {
    if (editorRef?.current) {
      const editor = editorRef.current;
      
      // Configure editor options for better copy handling
      editor.updateOptions({
        copyWithSyntaxHighlighting: true,
        emptySelectionClipboard: false
      });

      // Track selection changes
      const disposable = editor.onDidChangeCursorSelection((e) => {
        if (!e.selection.isEmpty()) {
          lastCopiedRangeRef.current = {
            startLine: e.selection.startLineNumber,
            endLine: e.selection.endLineNumber
          };
        }
      });

      return () => disposable.dispose();
    }
  }, [editorRef?.current]);

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
        className="flex-grow overflow-y-auto p-4 space-y-4"
      >
        {messages.map((message, messageIndex) => (
          <ChatMessage
            key={messageIndex}
            message={message}
            setContext={setContext}
            setIsContextExpanded={setIsContextExpanded}
            socket={socket}
          />
        ))}
        {isLoading && <LoadingDots />}
      </div>
      <div className="p-4 border-t mb-14">
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
              const fileExt = file.name.split('.').pop() || 'txt'
              const formattedContent = `\`\`\`${fileExt}\n${response}\n\`\`\``
              addContextTab('file', file.name, formattedContent)
              if (textareaRef.current) {
                textareaRef.current.focus()
              }
            })
          }}
        />
        <ChatInput
          textareaRef={textareaRef}
          files={[]}
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
          onFileMention={(fileName) => {
          }}
          lastCopiedRangeRef={lastCopiedRangeRef}
          activeFileName={activeFileName}
          contextTabs={contextTabs.map(tab => ({
            ...tab,
            title: tab.id // Add missing title property
          }))}
          onRemoveTab={removeContextTab}
        />
      </div>
    </div>
  )
}
