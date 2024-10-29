import { Send, StopCircle, AtSign, Image as ImageIcon } from "lucide-react"
import { Button } from "../../ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select"
import { useRef, useEffect, useState } from "react"
import * as monaco from 'monaco-editor'
import { TFile, TFolder } from "@/lib/types"

interface ChatInputProps {
  input: string
  setInput: (input: string) => void
  isGenerating: boolean
  handleSend: (useFullContext?: boolean) => void
  handleStopGeneration: () => void
  onImageUpload: (file: File) => void
  onFileMention: (fileName: string) => void
  addContextTab: (type: string, title: string, content: string, lineRange?: { start: number, end: number }) => void
  activeFileName?: string
  editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | undefined>
  lastCopiedRangeRef: React.MutableRefObject<{ startLine: number; endLine: number } | null>
  contextTabs: { id: string; type: string; title: string; content: string; lineRange?: { start: number; end: number } }[]
  onRemoveTab: (id: string) => void
  textareaRef: React.RefObject<HTMLTextAreaElement>
  files: (TFile | TFolder)[]
}

export default function ChatInput({
  input,
  setInput,
  isGenerating,
  handleSend,
  handleStopGeneration,
  onImageUpload,
  onFileMention,
  addContextTab,
  activeFileName,
  editorRef,
  lastCopiedRangeRef,
  contextTabs,
  onRemoveTab,
  textareaRef,
  files,
}: ChatInputProps) {
  // Auto-resize textarea as content changes
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [input])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (e.ctrlKey) {
        e.preventDefault()
        handleSend(true) // Send with full context
      } else if (!e.shiftKey && !isGenerating) {
        e.preventDefault()
        handleSend(false)
      }
    } else if (e.key === "Backspace" && input === "" && contextTabs.length > 0) {
      e.preventDefault()
      // Remove the last context tab
      const lastTab = contextTabs[contextTabs.length - 1]
      onRemoveTab(lastTab.id)
    }
  }

  const handlePaste = async (e: React.ClipboardEvent) => {
    // Handle image paste
    const items = Array.from(e.clipboardData.items);
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        
        const file = item.getAsFile();
        if (!file) continue;

        try {
          const reader = new FileReader();
          reader.onload = () => {
            const base64String = reader.result as string;
            addContextTab(
              "image",
              `Image ${new Date().toLocaleTimeString()}`,
              base64String
            );
          };
          reader.readAsDataURL(file);
        } catch (error) {
          console.error('Error processing pasted image:', error);
        }
        return;
      }
    }
    
    const text = e.clipboardData.getData('text');
    
    // Helper function to detect if text looks like code
    const looksLikeCode = (text: string): boolean => {
      const codeIndicators = [
        /^import\s+/m,           // import statements
        /^function\s+/m,         // function declarations
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

    // If text doesn't contain newlines or doesn't look like code, let it paste normally
    if (!text || !text.includes('\n') || !looksLikeCode(text)) {
      return;
    }

    e.preventDefault();
    const editor = editorRef.current;
    const currentSelection = editor?.getSelection();
    const lines = text.split('\n');
    
    // If selection exists in editor, use file name and line numbers
    if (currentSelection && !currentSelection.isEmpty()) {
      addContextTab(
        "code",
        `${activeFileName} (${currentSelection.startLineNumber}-${currentSelection.endLineNumber})`,
        text,
        { start: currentSelection.startLineNumber, end: currentSelection.endLineNumber }
      );
      return;
    }
    
    // If we have stored line range from a copy operation in the editor
    if (lastCopiedRangeRef.current) {
      const range = lastCopiedRangeRef.current;
      addContextTab(
        "code",
        `${activeFileName} (${range.startLine}-${range.endLine})`,
        text,
        { start: range.startLine, end: range.endLine }
      );
      return;
    }
    
    // For code pasted from outside the editor
    addContextTab(
      "code",
      `Pasted Code (1-${lines.length})`,
      text,
      { start: 1, end: lines.length }
    );
  };

  const handleImageUpload = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) onImageUpload(file)
    }
    input.click()
  }

  const handleMentionClick = () => {
    if (textareaRef.current) {
      const cursorPosition = textareaRef.current.selectionStart
      const newValue = input.slice(0, cursorPosition) + '@' + input.slice(cursorPosition)
      setInput(newValue)
      // Focus and move cursor after the @
      textareaRef.current.focus()
      const newPosition = cursorPosition + 1
      textareaRef.current.setSelectionRange(newPosition, newPosition)
    }
  }

  // Handle @ mentions in input
  useEffect(() => {
    const match = input.match(/@(\w+)$/)
    if (match) {
      const fileName = match[1]
      const allFiles = getAllFiles(files)
      const file = allFiles.find(file => file.name === fileName)
      if (file) {
        onFileMention(file.name)
      }
    }
  }, [input, onFileMention, files])

  // Add this helper function to flatten the file tree
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
      <div className="flex flex-wrap items-center gap-2 w-full">
        <div className="flex items-center gap-2 px-2 text-sm text-muted-foreground min-w-auto max-w-auto">
          <Select defaultValue="claude-3.5-sonnet">
            <SelectTrigger className="h-6 w-full border-none truncate">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="claude-3.5-sonnet">claude-3.5-sonnet</SelectItem>
              <SelectItem value="claude-3">claude-3</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Button 
            variant="ghost" 
            size="sm"
            className="h-6 px-2 sm:px-3"
            onClick={handleMentionClick}
          >
            <AtSign className="h-3 w-3 sm:mr-1" />
            <span className="hidden sm:inline">mention</span>
          </Button>
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
    </div>
  )
}

