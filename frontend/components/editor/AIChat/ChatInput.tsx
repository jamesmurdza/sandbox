import { TFile, TFolder } from "@/lib/types"
import { Image as ImageIcon, Paperclip, Send, StopCircle } from "lucide-react"
import { useEffect } from "react"
import { toast } from "sonner"
import { Button } from "../../ui/button"
import { looksLikeCode } from "./lib/chatUtils"
import { ALLOWED_FILE_TYPES, ChatInputProps } from "./types"

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
  }, [input])

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

  // Handle paste events for image and code
  const handlePaste = async (e: React.ClipboardEvent) => {
    // Handle image paste
    const items = Array.from(e.clipboardData.items)
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault()

        const file = item.getAsFile()
        if (!file) continue

        try {
          // Convert image to base64 string for context tab title and timestamp
          const reader = new FileReader()
          reader.onload = () => {
            const base64String = reader.result as string
            addContextTab(
              "image",
              `Image ${new Date()
                .toLocaleTimeString("en-US", {
                  hour12: true,
                  hour: "2-digit",
                  minute: "2-digit",
                })
                .replace(/(\d{2}):(\d{2})/, "$1:$2")}`,
              base64String
            )
          }
          reader.readAsDataURL(file)
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "Failed to process image"
          )
        }
        return
      }
    }

    // Get text from clipboard
    const text = e.clipboardData.getData("text")

    // If text doesn't contain newlines or doesn't look like code, let it paste normally
    if (!text || !text.includes("\n") || !looksLikeCode(text)) {
      return
    }

    e.preventDefault()
    const editor = editorRef.current
    const currentSelection = editor?.getSelection()
    const lines = text.split("\n")

    // TODO: FIX THIS: even when i paste the outside code, it shows the active file name,it works when no tabs are open, just does not work when the tab is open

    // If selection exists in editor, use file name and line numbers
    if (currentSelection && !currentSelection.isEmpty()) {
      addContextTab(
        "code",
        `${activeFileName} (${currentSelection.startLineNumber}-${currentSelection.endLineNumber})`,
        text,
        {
          start: currentSelection.startLineNumber,
          end: currentSelection.endLineNumber,
        }
      )
      return
    }

    // If we have stored line range from a copy operation in the editor
    if (lastCopiedRangeRef.current) {
      const range = lastCopiedRangeRef.current
      addContextTab(
        "code",
        `${activeFileName} (${range.startLine}-${range.endLine})`,
        text,
        { start: range.startLine, end: range.endLine }
      )
      return
    }

    // For code pasted from outside the editor
    addContextTab("code", `Pasted Code (1-${lines.length})`, text, {
      start: 1,
      end: lines.length,
    })
  }

  // Handle image upload from local machine via input
  const handleImageUpload = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) onImageUpload(file)
    }
    input.click()
  }

  // Helper function to flatten the file tree
  const getAllFiles = (items: (TFile | TFolder)[]): TFile[] => {
    return items.reduce((acc: TFile[], item) => {
      if (item.type === "file") {
        acc.push(item)
      } else {
        acc.push(...getAllFiles(item.children))
      }
      return acc
    }, [])
  }

  // Handle file upload from local machine via input
  const handleFileUpload = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".txt,.md,.csv,.json,.js,.ts,.html,.css,.pdf"
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        if (!(file.type in ALLOWED_FILE_TYPES)) {
          alert(
            "Unsupported file type. Please upload text, code, or PDF files."
          )
          return
        }

        const reader = new FileReader()
        reader.onload = () => {
          addContextTab("file", file.name, reader.result as string)
        }
        reader.readAsText(file)
      }
    }
    input.click()
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
        {/* Render stop generation button */}
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
      <div className="flex items-center justify-end gap-2">
        {/* Render file upload button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 sm:px-3"
          onClick={handleFileUpload}
        >
          <Paperclip className="h-3 w-3 sm:mr-1" />
          <span className="hidden sm:inline">File</span>
        </Button>
        {/* Render image upload button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 sm:px-3"
          onClick={handleImageUpload}
        >
          <ImageIcon className="h-3 w-3 sm:mr-1" />
          <span className="hidden sm:inline">Image</span>
        </Button>
      </div>
    </div>
  )
}
