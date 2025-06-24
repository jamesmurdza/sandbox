import { useEffect, useRef, useState } from "react"

/**
 * Custom hook for managing chat scroll behavior
 * Handles auto-scroll and scroll-to-bottom functionality
 */
export function useChatScroll(dependencies: any[] = []) {
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [showScrollButton, setShowScrollButton] = useState(false)

  /**
   * Scroll to the bottom of the chat
   */
  const scrollToBottom = (force: boolean = false) => {
    if (!chatContainerRef.current || (!autoScroll && !force)) return

    chatContainerRef.current.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: force ? "smooth" : "auto",
    })
  }

  /**
   * Handle scroll events to detect if user is at bottom
   */
  const handleScroll = () => {
    if (!chatContainerRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current
    const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 50

    setAutoScroll(isAtBottom)
    setShowScrollButton(!isAtBottom)
  }

  // Auto-scroll when dependencies change (e.g., new messages)
  useEffect(() => {
    if (autoScroll) {
      scrollToBottom()
    }
  }, dependencies)

  // Add scroll event listener
  useEffect(() => {
    const container = chatContainerRef.current
    if (container) {
      container.addEventListener("scroll", handleScroll)
      return () => container.removeEventListener("scroll", handleScroll)
    }
  }, [])

  return {
    chatContainerRef,
    showScrollButton,
    scrollToBottom,
  }
}
