import { Check, Copy, CornerUpLeft } from "lucide-react"
import { useTheme } from "next-themes"
import React, { useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "../../ui/button"
import ContextTabs from "./ContextTabs"
import { copyToClipboard, stringifyContent } from "./lib/chatUtils"
import { createMarkdownComponents } from "./lib/markdownComponents"
import { MessageProps } from "./types"

export default function ChatMessage({
  message,
  setContext,
  setIsContextExpanded,
  socket,
  handleApplyCode,
  activeFileName,
  activeFileContent,
  editorRef,
  mergeDecorationsCollection,
  setMergeDecorationsCollection,
  selectFile,
}: MessageProps) {
  const { resolvedTheme: theme } = useTheme()
  // State for expanded message index
  const [expandedMessageIndex, setExpandedMessageIndex] = useState<
    number | null
  >(null)

  // State for copied text
  const [copiedText, setCopiedText] = useState<string | null>(null)

  // Render copy button for text content
  const renderCopyButton = (text: any) => (
    <Button
      onClick={() => copyToClipboard(stringifyContent(text), setCopiedText)}
      size="sm"
      variant="ghost"
      className="p-1 h-6"
    >
      {copiedText === stringifyContent(text) ? (
        <Check className="w-4 h-4 text-green-500" />
      ) : (
        <Copy className="w-4 h-4" />
      )}
    </Button>
  )

  // Set context for code when asking about code
  const askAboutCode = (code: any) => {
    const contextString = stringifyContent(code)
    const newContext = `Regarding this code:\n${contextString}`

    // Format timestamp to match chat message format (HH:MM PM)
    const timestamp = new Date().toLocaleTimeString("en-US", {
      hour12: true,
      hour: "2-digit",
      minute: "2-digit",
    })

    // Instead of replacing context, append to it
    if (message.role === "assistant") {
      // For assistant messages, create a new context tab with the response content and timestamp
      setContext(newContext, `AI Response (${timestamp})`, {
        start: 1,
        end: contextString.split("\n").length,
      })
    } else {
      // For user messages, create a new context tab with the selected content and timestamp
      setContext(newContext, `User Chat (${timestamp})`, {
        start: 1,
        end: contextString.split("\n").length,
      })
    }
    setIsContextExpanded(false)
  }

  // Render markdown elements for code and text
  const renderMarkdownElement = (props: any) => {
    const { node, children } = props
    const content = stringifyContent(children)

    return (
      <div className="relative group">
        <div className="absolute top-0 right-0 flex opacity-0 group-hover:opacity-30 transition-opacity">
          {renderCopyButton(content)}
          <Button
            onClick={() => askAboutCode(content)}
            size="sm"
            variant="ghost"
            className="p-1 h-6"
          >
            <CornerUpLeft className="w-4 h-4" />
          </Button>
        </div>
        {/* Render markdown element */}
        {React.createElement(
          node.tagName,
          {
            ...props,
            className: `${
              props.className || ""
            } hover:bg-transparent rounded p-1 transition-colors`,
          },
          children
        )}
      </div>
    )
  }

  // Create markdown components
  const components = createMarkdownComponents(
    theme ?? "light",
    renderCopyButton,
    renderMarkdownElement,
    askAboutCode,
    activeFileName,
    activeFileContent,
    editorRef,
    handleApplyCode,
    selectFile,
    mergeDecorationsCollection,
    setMergeDecorationsCollection
  )

  return (
    <div className="text-left relative">
      <div
        className={`relative p-2 rounded-lg ${
          message.role === "user"
            ? "bg-foreground/80 text-background"
            : "bg-background text-foreground"
        } max-w-full`}
      >
        {/* Render context tabs */}
        {message.role === "user" && message.context && (
          <div className="mb-2 rounded-lg">
            <ContextTabs
              socket={socket}
              activeFileName=""
              onAddFile={() => {}}
              contextTabs={parseContextToTabs(message.context)}
              onRemoveTab={() => {}}
              isExpanded={expandedMessageIndex === 0}
              onToggleExpand={() =>
                setExpandedMessageIndex(expandedMessageIndex === 0 ? null : 0)
              }
            />
            {expandedMessageIndex === 0 && (
              <div className="relative">
                <div className="absolute top-0 right-0 flex p-1">
                  {renderCopyButton(
                    message.context.replace(/^Regarding this code:\n/, "")
                  )}
                </div>
                {/* Render code textarea */}
                {(() => {
                  const code = message.context.replace(
                    /^Regarding this code:\n/,
                    ""
                  )
                  const match = /language-(\w+)/.exec(code)
                  const language = match ? match[1] : "typescript"
                  return (
                    <div className="pt-6">
                      <textarea
                        value={code}
                        onChange={(e) => {
                          const updatedContext = `Regarding this code:\n${e.target.value}`
                          setContext(updatedContext, "Selected Content", {
                            start: 1,
                            end: e.target.value.split("\n").length,
                          })
                        }}
                        className="w-full p-2 bg-[#1e1e1e] text-foreground font-mono text-sm rounded"
                        rows={code.split("\n").length}
                        style={{
                          resize: "vertical",
                          minHeight: "100px",
                          maxHeight: "400px",
                        }}
                      />
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        )}
        {/* Render copy and ask about code buttons */}
        {message.role === "user" && (
          <div className="absolute top-0 right-0 p-1 flex opacity-40">
            {renderCopyButton(message.content)}
            <Button
              onClick={() => askAboutCode(message.content)}
              size="sm"
              variant="ghost"
              className="p-1 h-6"
            >
              <CornerUpLeft className="w-4 h-4" />
            </Button>
          </div>
        )}
        {/* Render markdown content */}
        {message.role === "assistant" ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {message.content}
          </ReactMarkdown>
        ) : (
          <div className="whitespace-pre-wrap group">{message.content}</div>
        )}
      </div>
    </div>
  )
}

// Parse context to tabs for context tabs component
function parseContextToTabs(context: string) {
  // Use specific regex patterns to avoid matching import statements
  const sections = context.split(/(?=File |Code from |Image \d{1,2}:)/)
  return sections
    .map((section, index) => {
      const lines = section.trim().split("\n")
      const titleLine = lines[0]
      let content = lines.slice(1).join("\n").trim()

      // Remove code block markers for display
      content = content.replace(/^```[\w-]*\n/, "").replace(/\n```$/, "")

      // Determine the type of context
      const isFile = titleLine.startsWith("File ")
      const isImage = titleLine.startsWith("Image ")
      const type = isFile ? "file" : isImage ? "image" : "code"
      const name = titleLine
        .replace(/^(File |Code from |Image )/, "")
        .replace(":", "")
        .trim()

      // Skip if the content is empty or if it's just an import statement
      if (!content || content.trim().startsWith('from "')) {
        return null
      }

      return {
        id: `context-${index}`,
        type: type as "file" | "code" | "image",
        name: name,
        content: content,
      }
    })
    .filter(
      (tab): tab is NonNullable<typeof tab> =>
        tab !== null && tab.content.length > 0
    )
}
