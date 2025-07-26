import { streamChat } from "@/app/actions/ai"
import { TFile, TFolder } from "@/lib/types"
import { readStreamableValue } from "ai/rsc"
import { nanoid } from "nanoid"
import { useRef, useState } from "react"
import { ContextTab, Message } from "../lib/types"

/**
 * Custom hook for managing chat functionality
 * Handles messages, context, and AI interactions
 */
export function useChat(
  activeFileContent: string,
  templateType: string,
  files: (TFile | TFolder)[],
  projectName: string
) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [contextTabs, setContextTabs] = useState<ContextTab[]>([])
  const abortControllerRef = useRef<AbortController | null>(null)

  /**
   * Add a new context tab
   */
  const addContextTab = (
    type: "file" | "code" | "image",
    title: string,
    content: string,
    lineRange?: { start: number; end: number }
  ) => {
    const newTab: ContextTab = {
      id: nanoid(),
      type,
      name: title,
      content,
      lineRange,
    }
    setContextTabs((prev) => [...prev, newTab])
  }

  /**
   * Remove a context tab by ID
   */
  const removeContextTab = (id: string) => {
    setContextTabs((prev) => prev.filter((tab) => tab.id !== id))
  }

  /**
   * Get combined context from all tabs
   */
  const getCombinedContext = () => {
    if (contextTabs.length === 0) return ""

    return contextTabs
      .map((tab) => {
        const cleanContent = tab.content
          .replace(/^```[\w-]*\n/, "")
          .replace(/\n```$/, "")

        if (tab.type === "file") {
          const fileExt = tab.name.split(".").pop() || "txt"
          return `File ${tab.name}:\n\`\`\`${fileExt}\n${cleanContent}\n\`\`\``
        } else if (tab.type === "code") {
          return `Code from ${tab.name}:\n\`\`\`typescript\n${cleanContent}\n\`\`\``
        } else if (tab.type === "image") {
          return `Image ${tab.name}:\n${tab.content}`
        }
        return `${tab.name}:\n${tab.content}`
      })
      .join("\n\n")
  }

  /**
   * Send a message to the AI
   */
  const sendMessage = async (message: string, context?: string) => {
    if (!message.trim() && !context) return

    const userMessage: Message = {
      role: "user",
      content: message,
      context,
    }

    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput("")
    setIsGenerating(true)
    setIsLoading(true)

    abortControllerRef.current = new AbortController()

    try {
      const { output } = await streamChat(updatedMessages, {
        templateType,
        activeFileContent,
        files,
        projectName,
        isEditMode: false,
      })

      const assistantMessage: Message = { role: "assistant", content: "" }
      setMessages([...updatedMessages, assistantMessage])
      setIsLoading(false)

      let buffer = ""
      for await (const chunk of readStreamableValue(output)) {
        if (abortControllerRef.current?.signal.aborted) break

        buffer += chunk
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1].content = buffer
          return updated
        })
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("Generation aborted")
      } else {
        console.error("Error:", error)
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: error.message || "Sorry, an error occurred.",
          },
        ])
      }
    } finally {
      setIsGenerating(false)
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  /**
   * Stop the current generation
   */
  const stopGeneration = () => {
    abortControllerRef.current?.abort()
  }

  return {
    messages,
    setMessages,
    input,
    setInput,
    isGenerating,
    isLoading,
    contextTabs,
    addContextTab,
    removeContextTab,
    getCombinedContext,
    sendMessage,
    stopGeneration,
  }
}
