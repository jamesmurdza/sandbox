import React from "react"

// Stringify content for chat message component 
export const stringifyContent = (
  content: any,
  seen = new WeakSet()
): string => {
  // Stringify content if it's a string
  if (typeof content === "string") {
    return content
  }
  // Stringify content if it's null
  if (content === null) {
    return "null"
  }
  // Stringify content if it's undefined
  if (content === undefined) {
    return "undefined"
  }
  // Stringify content if it's a number or boolean
  if (typeof content === "number" || typeof content === "boolean") {
    return content.toString()
  }
  // Stringify content if it's a function
  if (typeof content === "function") {
    return content.toString()
  }
  // Stringify content if it's a symbol
  if (typeof content === "symbol") {
    return content.toString()
  }
  // Stringify content if it's a bigint
  if (typeof content === "bigint") {
    return content.toString() + "n"
  }
  // Stringify content if it's a valid React element
  if (React.isValidElement(content)) {
    return React.Children.toArray(
      (content as React.ReactElement).props.children
    )
      .map((child) => stringifyContent(child, seen))
      .join("")
  }
  // Stringify content if it's an array
  if (Array.isArray(content)) {
    return (
      "[" + content.map((item) => stringifyContent(item, seen)).join(", ") + "]"
    )
  }
  // Stringify content if it's an object
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
  // Stringify content if it's a primitive value
  return String(content)
}

// Copy to clipboard for chat message component  
export const copyToClipboard = (
  text: string,
  setCopiedText: (text: string | null) => void
) => {
  // Copy text to clipboard for chat message component 
  navigator.clipboard.writeText(text).then(() => {
    setCopiedText(text)
    setTimeout(() => setCopiedText(null), 2000)
  })
}

// Handle send for chat message component  
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
  // Return if input is empty and context is null
  if (input.trim() === "" && !context) return 

  // Get timestamp for chat message component 
  const timestamp = new Date().toLocaleTimeString('en-US', {
    hour12: true,
    hour: '2-digit',
    minute: '2-digit'
  }).replace(/(\d{2}):(\d{2})/, '$1:$2')

  // Create user message for chat message component 
  const userMessage = {
    role: "user" as const,
    content: input,
    context: context || undefined,
    timestamp: timestamp
  }

  // Update messages for chat message component 
  const updatedMessages = [...messages, userMessage]
  setMessages(updatedMessages)
  setInput("")
  setIsContextExpanded(false)
  setIsGenerating(true)
  setIsLoading(true)

  abortControllerRef.current = new AbortController()

  try {
    // Create anthropic messages for chat message component 
    const anthropicMessages = updatedMessages.map((msg) => ({
      role: msg.role === "user" ? "human" : "assistant",
      content: msg.content,
    }))

    // Fetch AI response for chat message component 
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

    // Throw error if response is not ok
    if (!response.ok) {
      throw new Error("Failed to get AI response")
    }

    // Get reader for chat message component 
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    const assistantMessage = { role: "assistant" as const, content: "" }
    setMessages([...updatedMessages, assistantMessage])
    setIsLoading(false)

    // Initialize buffer for chat message component 
    let buffer = ""
    const updateInterval = 100
    let lastUpdateTime = Date.now()

    // Read response from reader for chat message component 
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

      // Update messages for chat message component 
      setMessages((prev) => {
        const updatedMessages = [...prev]
        const lastMessage = updatedMessages[updatedMessages.length - 1]
        lastMessage.content = buffer
        return updatedMessages
      })
    }
  } catch (error: any) {
    // Handle abort error for chat message component 
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

// Handle stop generation for chat message component 
export const handleStopGeneration = (
  abortControllerRef: React.MutableRefObject<AbortController | null>
) => {
  if (abortControllerRef.current) {
    abortControllerRef.current.abort()
  }
}

// Check if text looks like code for chat message component 
export const looksLikeCode = (text: string): boolean => {
  const codeIndicators = [
    /^import\s+/m,          // import statements
    /^function\s+/m,        // function declarations
    /^class\s+/m,           // class declarations
    /^const\s+/m,           // const declarations
    /^let\s+/m,             // let declarations
    /^var\s+/m,             // var declarations
    /[{}\[\]();]/,          // common code syntax
    /^\s*\/\//m,            // comments
    /^\s*\/\*/m,            // multi-line comments
    /=>/,                   // arrow functions
    /^export\s+/m,          // export statements
  ];

  return codeIndicators.some(pattern => pattern.test(text));
};
