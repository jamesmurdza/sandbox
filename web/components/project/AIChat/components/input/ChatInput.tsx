import { Image as ImageIcon, Paperclip, Send, StopCircle } from "lucide-react"
import { useEffect } from "react"
import { Button } from "../../../../ui/button"
import { usePasteHandler } from "../../hooks/usePasteHandler"
import { ALLOWED_FILE_TYPES, ChatInputProps } from "../../lib/types"
import FileUploadButton from "./FileUploadButton"

/**
 * Chat input component
 * Handles user input, file uploads, and message sending
 */
export default function ChatInput({
  input,
  setInput,
  isGenerating,
  handleSend,
  handleStopGeneration,
  onImageUpload,
  addContextTab,
  activeFileName,
  editorRef,
  lastCopiedRangeRef,
  contextTabs,
  onRemoveTab,
  textareaRef,
}: ChatInputProps) {
  // Auto-resize textarea as content changes
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px"
    }
  }, [input, textareaRef])

  // Use paste handler hook
  const { handlePaste } = usePasteHandler({
    activeFileName: activeFileName || "",
    editorRef,
    lastCopiedRangeRef,
    addContextTab,
  })

  // Handle keyboard events for sending messages
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (e.ctrlKey) {
        e.preventDefault()
        handleSend(true) // Send with full context
      } else if (!e.shiftKey && !isGenerating) {
        e.preventDefault()
        handleSend(false)
      }
    } else if (
      e.key === "Backspace" &&
      input === "" &&
      contextTabs.length > 0
    ) {
      e.preventDefault()
      // Remove the last context tab
      const lastTab = contextTabs[contextTabs.length - 1]
      onRemoveTab(lastTab.id)
    }
  }

  // Handle file upload
  const handleFileUpload = (file: File) => {
    if (!(file.type in ALLOWED_FILE_TYPES)) {
      alert("Unsupported file type. Please upload text, code, or PDF files.")
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      addContextTab("file", file.name, reader.result as string)
    }
    reader.readAsText(file)
  }

  return (
    <div className="space-y-2">
      <div className="flex space-x-2 min-w-0">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          className="flex-grow p-2 border rounded-lg min-w-0 bg-input resize-none overflow-hidden"
          placeholder="Type your message..."
          disabled={isGenerating}
          rows={1}
        />

        {/* Send/Stop button */}
        {isGenerating ? (
          <Button
            onClick={handleStopGeneration}
            variant="destructive"
            size="icon"
            className="h-10 w-10"
          >
            <StopCircle className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            onClick={() => handleSend(false)}
            disabled={isGenerating}
            size="icon"
            className="h-10 w-10"
          >
            <Send className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Upload buttons */}
      <div className="flex items-center justify-end gap-2">
        <FileUploadButton
          accept=".txt,.md,.csv,.json,.js,.ts,.html,.css,.pdf"
          onFileSelect={handleFileUpload}
          icon={<Paperclip className="h-3 w-3 sm:mr-1" />}
          label="File"
        />
        <FileUploadButton
          accept="image/*"
          onFileSelect={onImageUpload}
          icon={<ImageIcon className="h-3 w-3 sm:mr-1" />}
          label="Image"
        />
      </div>
    </div>
  )
}
