import { X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import LoadingDots from "../../ui/LoadingDots"
import ChatInput from "./ChatInput"
import ChatMessage from "./ChatMessage"
import ContextDisplay from "./ContextDisplay"
import { handleSend, handleStopGeneration } from "./lib/chatUtils"

interface Message {
  role: "user" | "assistant"
  content: string
  context?: string
}

export default function AIChat({
  activeFileContent,
  activeFileName,
  onClose,
}: {
  activeFileContent: string
  activeFileName: string
  onClose: () => void
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const [context, setContext] = useState<string | null>(null)
  const [isContextExpanded, setIsContextExpanded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

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
          />
        ))}
        {isLoading && <LoadingDots />}
      </div>
      <div className="p-4 border-t mb-14">
        <ContextDisplay
          context={context}
          isContextExpanded={isContextExpanded}
          setIsContextExpanded={setIsContextExpanded}
          setContext={setContext}
        />
        <ChatInput
          input={input}
          setInput={setInput}
          isGenerating={isGenerating}
          handleSend={() =>
            handleSend(
              input,
              context,
              messages,
              setMessages,
              setInput,
              setIsContextExpanded,
              setIsGenerating,
              setIsLoading,
              abortControllerRef,
              activeFileContent
            )
          }
          handleStopGeneration={() => handleStopGeneration(abortControllerRef)}
        />
      </div>
    </div>
  )
}
