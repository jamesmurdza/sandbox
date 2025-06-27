import { useTheme } from "next-themes"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useState } from "react"
import { Button } from "../../../../ui/button"
import { Check, Copy } from "lucide-react"
import { createMarkdownComponents } from "../../lib/create-markdown-components"
import { Message } from "../../lib/types"
import { copyToClipboard } from "../../lib/utils"

interface AssistantMessageProps {
  message: Message
  activeFileName: string
  activeFileContent: string
  editorRef: any
  handleApplyCode: (mergedCode: string, originalCode: string) => void
  selectFile: any
  tabs: any[]
  projectId: string
  mergeDecorationsCollection?: any
  setMergeDecorationsCollection?: (collection: undefined) => void
  askAboutCode: (code: any) => void
}

/**
 * Assistant message component
 * Renders AI responses with markdown and code highlighting
 */
export default function AssistantMessage({
  message,
  activeFileName,
  activeFileContent,
  editorRef,
  handleApplyCode,
  selectFile,
  tabs,
  projectId,
  mergeDecorationsCollection,
  setMergeDecorationsCollection,
  askAboutCode,
}: AssistantMessageProps) {
  const { resolvedTheme: theme } = useTheme()
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const renderCopyButton = (text: any) => {
    return (
      <Button
        onClick={() => copyToClipboard(text, setCopiedText)}
        size="sm"
        variant="ghost"
        className="p-1 h-6"
      >
        {copiedText === text ? (
          <Check className="w-4 h-4 text-green-500" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </Button>
    )
  }

  const components = createMarkdownComponents(
    theme ?? "light",
    renderCopyButton,
    askAboutCode,
    activeFileName,
    activeFileContent,
    editorRef,
    handleApplyCode,
    selectFile,
    tabs,
    projectId,
    mergeDecorationsCollection,
    setMergeDecorationsCollection
  )

  return (
    <div className="relative p-2 rounded-lg bg-background text-foreground max-w-full">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {message.content}
      </ReactMarkdown>
    </div>
  )
}
