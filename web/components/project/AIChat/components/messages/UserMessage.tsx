import { useState } from "react"
import { Message } from "../../lib/types"
import { copyToClipboard, parseContextToTabs } from "../../lib/utils"
import ContextTabs from "../common/ContextTabs"
import UserMessageActionButtons from "./UserMessageActionButtons"

interface UserMessageProps {
  message: Message
  onAskAbout: (content: any) => void
  onContextChange?: (
    context: string,
    name: string,
    range?: { start: number; end: number }
  ) => void
}

/**
 * User message component
 * Displays user messages with context and action buttons
 */
export default function UserMessage({
  message,
  onAskAbout,
  onContextChange,
}: UserMessageProps) {
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const [expandedContext, setExpandedContext] = useState(false)

  const handleCopy = (text: string) => {
    copyToClipboard(text, setCopiedText)
  }

  return (
    <div className="relative p-2 rounded-lg bg-foreground/80 text-background max-w-full">
      {/* Context tabs if present */}
      {message.context && (
        <div className="mb-2 rounded-lg">
          <ContextTabs
            socket={null}
            activeFileName=""
            onAddFile={() => {}}
            contextTabs={parseContextToTabs(message.context)}
            onRemoveTab={() => {}}
            isExpanded={expandedContext}
            onToggleExpand={() => setExpandedContext(!expandedContext)}
          />
          {expandedContext && onContextChange && (
            <div className="relative pt-6">
              <div className="absolute top-0 right-0 p-1">
                <UserMessageActionButtons
                  content={message.context.replace(
                    /^Regarding this code:\n/,
                    ""
                  )}
                  onCopy={handleCopy}
                  onAskAbout={onAskAbout}
                  copiedText={copiedText}
                />
              </div>
              <textarea
                value={message.context.replace(/^Regarding this code:\n/, "")}
                onChange={(e) => {
                  const updatedContext = `Regarding this code:\n${e.target.value}`
                  onContextChange(updatedContext, "Selected Content", {
                    start: 1,
                    end: e.target.value.split("\n").length,
                  })
                }}
                className="w-full p-2 bg-[#1e1e1e] text-foreground font-mono text-sm rounded"
                rows={message.context.split("\n").length - 1}
                style={{
                  resize: "vertical",
                  minHeight: "100px",
                  maxHeight: "400px",
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Message content with action buttons */}
      <div className="absolute top-0 right-0 p-1 opacity-40">
        <UserMessageActionButtons
          content={message.content}
          onCopy={handleCopy}
          onAskAbout={onAskAbout}
          copiedText={copiedText}
        />
      </div>
      <div className="whitespace-pre-wrap group">{message.content}</div>
    </div>
  )
}
