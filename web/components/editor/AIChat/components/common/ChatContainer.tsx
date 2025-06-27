import LoadingDots from "@/components/ui/LoadingDots"
import { ChevronDown } from "lucide-react"
import { useChatScroll } from "../../hooks/useChatScroll"
import { Message } from "../../lib/types"
import ChatMessage from "../messages/ChatMessage"

interface ChatContainerProps {
  messages: Message[]
  isLoading: boolean
  messageProps: Omit<React.ComponentProps<typeof ChatMessage>, "message">
}

/**
 * Chat container component
 * Handles message display and scroll management
 */
export default function ChatContainer({
  messages,
  isLoading,
  messageProps,
}: ChatContainerProps) {
  const { chatContainerRef, showScrollButton, scrollToBottom } = useChatScroll([
    messages,
  ])

  return (
    <>
      <div
        ref={chatContainerRef}
        className="flex-grow p-4 space-y-4 relative overflow-y-auto styled-scrollbar"
      >
        {messages.map((message, index) => (
          <ChatMessage key={index} message={message} {...messageProps} />
        ))}
        {isLoading && <LoadingDots />}
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <button
          onClick={() => scrollToBottom(true)}
          className="fixed bottom-36 right-6 bg-primary text-primary-foreground rounded-md border border-primary p-0.5 shadow-lg hover:bg-primary/90 transition-all"
          aria-label="Scroll to bottom"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      )}
    </>
  )
}
