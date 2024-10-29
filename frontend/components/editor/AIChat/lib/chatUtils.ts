import React from "react"

export const stringifyContent = (
  content: any,
  seen = new WeakSet()
): string => {
  if (typeof content === "string") {
    return content
  }
  if (content === null) {
    return "null"
  }
  if (content === undefined) {
    return "undefined"
  }
  if (typeof content === "number" || typeof content === "boolean") {
    return content.toString()
  }
  if (typeof content === "function") {
    return content.toString()
  }
  if (typeof content === "symbol") {
    return content.toString()
  }
  if (typeof content === "bigint") {
    return content.toString() + "n"
  }
  if (React.isValidElement(content)) {
    return React.Children.toArray(
      (content as React.ReactElement).props.children
    )
      .map((child) => stringifyContent(child, seen))
      .join("")
  }
  if (Array.isArray(content)) {
    return (
      "[" + content.map((item) => stringifyContent(item, seen)).join(", ") + "]"
    )
  }
  if (typeof content === "object") {
    if (seen.has(content)) {
      return "[Circular]"
    }
    seen.add(content)
    try {
      const pairs = Object.entries(content).map(
        ([key, value]) => `${key}: ${stringifyContent(value, seen)}`
      )
      return "{" + pairs.join(", ") + "}"
    } catch (error) {
      return Object.prototype.toString.call(content)
    }
  }
  return String(content)
}

export const copyToClipboard = (
  text: string,
  setCopiedText: (text: string | null) => void
) => {
  navigator.clipboard.writeText(text).then(() => {
    setCopiedText(text)
    setTimeout(() => setCopiedText(null), 2000)
  })
}

export const handleSend = async (
  input: string,
  context: string | null,
  messages: any[],
  setMessages: React.Dispatch<React.SetStateAction<any[]>>,
  setInput: React.Dispatch<React.SetStateAction<string>>,
  setIsContextExpanded: React.Dispatch<React.SetStateAction<boolean>>,
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  abortControllerRef: React.MutableRefObject<AbortController | null>,
  activeFileContent: string
) => {
  if (input.trim() === "" && !context) return

  const newMessage = {
    role: "user" as const,
    content: input,
    context: context || undefined,
  }
  const updatedMessages = [...messages, newMessage]
  setMessages(updatedMessages)
  setInput("")
  setIsContextExpanded(false)
  setIsGenerating(true)
  setIsLoading(true)

  abortControllerRef.current = new AbortController()

  try {
    const anthropicMessages = updatedMessages.map((msg) => ({
      role: msg.role === "user" ? "human" : "assistant",
      content: msg.content,
    }))

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_AI_WORKER_URL}/api`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: anthropicMessages,
          context: context || undefined,
          activeFileContent: activeFileContent,
        }),
        signal: abortControllerRef.current.signal,
      }
    )

    if (!response.ok) {
      throw new Error("Failed to get AI response")
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    const assistantMessage = { role: "assistant" as const, content: "" }
    setMessages([...updatedMessages, assistantMessage])
    setIsLoading(false)

    let buffer = ""
    const updateInterval = 100
    let lastUpdateTime = Date.now()

    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const currentTime = Date.now()
        if (currentTime - lastUpdateTime > updateInterval) {
          setMessages((prev) => {
            const updatedMessages = [...prev]
            const lastMessage = updatedMessages[updatedMessages.length - 1]
            lastMessage.content = buffer
            return updatedMessages
          })
          lastUpdateTime = currentTime
        }
      }

      setMessages((prev) => {
        const updatedMessages = [...prev]
        const lastMessage = updatedMessages[updatedMessages.length - 1]
        lastMessage.content = buffer
        return updatedMessages
      })
    }
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.log("Generation aborted")
    } else {
      console.error("Error fetching AI response:", error)
      const errorMessage = {
        role: "assistant" as const,
        content: "Sorry, I encountered an error. Please try again.",
      }
      setMessages((prev) => [...prev, errorMessage])
    }
  } finally {
    setIsGenerating(false)
    setIsLoading(false)
    abortControllerRef.current = null
  }
}

export const handleStopGeneration = (
  abortControllerRef: React.MutableRefObject<AbortController | null>
) => {
  if (abortControllerRef.current) {
    abortControllerRef.current.abort()
  }
}
