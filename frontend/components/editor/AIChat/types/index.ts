import { TemplateConfig } from "@/lib/templates"
import { TFile, TFolder, TTab } from "@/lib/types"
import * as monaco from "monaco-editor"
import { Socket } from "socket.io-client"

// Allowed file types for context tabs
export const ALLOWED_FILE_TYPES = {
  // Text files
  "text/plain": true,
  "text/markdown": true,
  "text/csv": true,
  // Code files
  "application/json": true,
  "text/javascript": true,
  "text/typescript": true,
  "text/html": true,
  "text/css": true,
  // Documents
  "application/pdf": true,
  // Images
  "image/jpeg": true,
  "image/png": true,
  "image/gif": true,
  "image/webp": true,
  "image/svg+xml": true,
} as const

// Message interface
export interface Message {
  role: "user" | "assistant"
  content: string
  context?: string
}

// Context tab interface
export interface ContextTab {
  id: string
  type: "file" | "code" | "image"
  name: string
  content: string
  lineRange?: { start: number; end: number }
}

// AIChat props interface
export interface AIChatProps {
  activeFileContent: string
  activeFileName: string
  onClose: () => void
  editorRef: React.MutableRefObject<
    monaco.editor.IStandaloneCodeEditor | undefined
  >
  lastCopiedRangeRef: React.MutableRefObject<{
    startLine: number
    endLine: number
  } | null>
  files: (TFile | TFolder)[]
  templateType: string
  templateConfig?: TemplateConfig
  projectName: string
  projectId: string
  handleApplyCode: (mergedCode: string, originalCode: string) => void
  mergeDecorationsCollection?: monaco.editor.IEditorDecorationsCollection
  setMergeDecorationsCollection?: (collection: undefined) => void
  selectFile: (tab: TTab) => void
  tabs: TTab[]
  handleAcceptAllChanges?: () => void
  fileDiffStates?: React.MutableRefObject<Map<string, { granularState: any; decorationsCollection: monaco.editor.IEditorDecorationsCollection | undefined }>>
  activeFileId?: string
}

// Chat input props interface
export interface ChatInputProps {
  input: string
  setInput: (input: string) => void
  isGenerating: boolean
  handleSend: (useFullContext?: boolean) => void
  handleStopGeneration: () => void
  onImageUpload: (file: File) => void
  addContextTab: (
    type: string,
    title: string,
    content: string,
    lineRange?: { start: number; end: number }
  ) => void
  activeFileName?: string
  editorRef: React.MutableRefObject<
    monaco.editor.IStandaloneCodeEditor | undefined
  >
  lastCopiedRangeRef: React.MutableRefObject<{
    startLine: number
    endLine: number
  } | null>
  contextTabs: {
    id: string
    type: string
    title: string
    content: string
    lineRange?: { start: number; end: number }
  }[]
  onRemoveTab: (id: string) => void
  textareaRef: React.RefObject<HTMLTextAreaElement>
}

// Chat message props interface
export interface MessageProps {
  message: {
    role: "user" | "assistant"
    content: string
    context?: string
  }
  setContext: (
    context: string | null,
    name: string,
    range?: { start: number; end: number }
  ) => void
  setIsContextExpanded: (isExpanded: boolean) => void
  socket: Socket | null
  handleApplyCode: (mergedCode: string, originalCode: string) => void
  activeFileName: string
  activeFileContent: string
  editorRef: any
  mergeDecorationsCollection?: monaco.editor.IEditorDecorationsCollection
  setMergeDecorationsCollection?: (collection: undefined) => void
  selectFile: (tab: TTab) => void
  tabs: TTab[]
  projectId: string
  handleAcceptAllChanges?: () => void
  fileDiffStates?: React.MutableRefObject<Map<string, { granularState: any; decorationsCollection: monaco.editor.IEditorDecorationsCollection | undefined }>>
  activeFileId?: string
}

// Context tabs props interface
export interface ContextTabsProps {
  activeFileName: string
  onAddFile: (tab: ContextTab) => void
  contextTabs: ContextTab[]
  onRemoveTab: (id: string) => void
  isExpanded: boolean
  onToggleExpand: () => void
  files?: (TFile | TFolder)[]
  onFileSelect?: (file: TFile) => void
  socket: Socket | null
}
