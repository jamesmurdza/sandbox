import { Check, ChevronDown, ChevronUp, Copy, CornerUpLeft } from "lucide-react"
import React, { useState } from "react"
import ReactMarkdown from "react-markdown"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"
import remarkGfm from "remark-gfm"
import { Button } from "../../ui/button"
import { copyToClipboard, stringifyContent } from "./lib/chatUtils"

interface MessageProps {
  message: {
    role: "user" | "assistant"
    content: string
    context?: string
  }
  setContext: (context: string | null) => void
  setIsContextExpanded: (isExpanded: boolean) => void
}

export default function ChatMessage({
  message,
  setContext,
  setIsContextExpanded,
}: MessageProps) {
  const [expandedMessageIndex, setExpandedMessageIndex] = useState<
    number | null
  >(null)
  const [copiedText, setCopiedText] = useState<string | null>(null)

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

  const askAboutCode = (code: any) => {
    const contextString = stringifyContent(code)
    setContext(`Regarding this code:\n${contextString}`)
    setIsContextExpanded(false)
  }

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

  return (
    <div className="text-left relative">
      <div
        className={`relative p-2 rounded-lg ${
          message.role === "user"
            ? "bg-[#262626] text-white"
            : "bg-transparent text-white"
        } max-w-full`}
      >
        {message.role === "user" && (
          <div className="absolute top-0 right-0 flex opacity-0 group-hover:opacity-30 transition-opacity">
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
        {message.context && (
          <div className="mb-2 bg-input rounded-lg">
            <div
              className="flex justify-between items-center cursor-pointer"
              onClick={() =>
                setExpandedMessageIndex(expandedMessageIndex === 0 ? null : 0)
              }
            >
              <span className="text-sm text-gray-300">Context</span>
              {expandedMessageIndex === 0 ? (
                <ChevronUp size={16} />
              ) : (
                <ChevronDown size={16} />
              )}
            </div>
            {expandedMessageIndex === 0 && (
              <div className="relative">
                <div className="absolute top-0 right-0 flex p-1">
                  {renderCopyButton(
                    message.context.replace(/^Regarding this code:\n/, "")
                  )}
                </div>
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
                          setContext(updatedContext)
                        }}
                        className="w-full p-2 bg-[#1e1e1e] text-white font-mono text-sm rounded"
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
        {message.role === "assistant" ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || "")
                return match ? (
                  <div className="relative border border-input rounded-md my-4">
                    <div className="absolute top-0 left-0 px-2 py-1 text-xs font-semibold text-gray-200 bg-#1e1e1e rounded-tl">
                      {match[1]}
                    </div>
                    <div className="absolute top-0 right-0 flex">
                      {renderCopyButton(children)}
                      <Button
                        onClick={() => askAboutCode(children)}
                        size="sm"
                        variant="ghost"
                        className="p-1 h-6"
                      >
                        <CornerUpLeft className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="pt-6">
                      <SyntaxHighlighter
                        style={vscDarkPlus as any}
                        language={match[1]}
                        PreTag="div"
                        customStyle={{
                          margin: 0,
                          padding: "0.5rem",
                          fontSize: "0.875rem",
                        }}
                      >
                        {stringifyContent(children)}
                      </SyntaxHighlighter>
                    </div>
                  </div>
                ) : (
                  <code className={className} {...props}>
                    {children}
                  </code>
                )
              },
              p: renderMarkdownElement,
              h1: renderMarkdownElement,
              h2: renderMarkdownElement,
              h3: renderMarkdownElement,
              h4: renderMarkdownElement,
              h5: renderMarkdownElement,
              h6: renderMarkdownElement,
              ul: (props) => (
                <ul className="list-disc pl-6 mb-4 space-y-2">
                  {props.children}
                </ul>
              ),
              ol: (props) => (
                <ol className="list-decimal pl-6 mb-4 space-y-2">
                  {props.children}
                </ol>
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
        ) : (
          <div className="whitespace-pre-wrap group">{message.content}</div>
        )}
      </div>
    </div>
  )
}
