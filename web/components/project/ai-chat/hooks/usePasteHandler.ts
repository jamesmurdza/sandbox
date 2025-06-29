import { ClipboardEvent } from "react"
import { looksLikeCode } from "../lib/utils"

interface PasteHandlerProps {
  activeFileName: string
  editorRef: any
  lastCopiedRangeRef: any
  addContextTab: (
    type: "file" | "code" | "image",
    title: string,
    content: string,
    lineRange?: { start: number; end: number }
  ) => void
}

/**
 * Custom hook for handling paste events
 * Manages pasting of images and code snippets
 */
export function usePasteHandler({
  activeFileName,
  editorRef,
  lastCopiedRangeRef,
  addContextTab,
}: PasteHandlerProps) {
  const handlePaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    // Handle image paste
    const items = Array.from(e.clipboardData.items)
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) continue

        try {
          const reader = new FileReader()
          reader.onload = () => {
            const base64String = reader.result as string
            const timestamp = new Date().toLocaleTimeString("en-US", {
              hour12: true,
              hour: "2-digit",
              minute: "2-digit",
            })
            addContextTab("image", `Image ${timestamp}`, base64String)
          }
          reader.readAsDataURL(file)
        } catch (error) {
          console.error("Error processing pasted image:", error)
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

  return { handlePaste }
}
