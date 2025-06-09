"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { apiClient } from "@/server/client-side-client"
import { useClerk } from "@clerk/nextjs"
import Editor, { BeforeMount, OnMount } from "@monaco-editor/react"
import { diffLines } from 'diff'
import { AnimatePresence, motion } from "framer-motion"
import { X } from "lucide-react"
import * as monaco from "monaco-editor"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "../ui/button"

// import { TypedLiveblocksProvider, useRoom, useSelf } from "@/liveblocks.config"
// import LiveblocksProvider from "@liveblocks/yjs"
// import { MonacoBinding } from "y-monaco"
// import { Awareness } from "y-protocols/awareness"
// import * as Y from "yjs"

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { PreviewProvider, usePreview } from "@/context/PreviewContext"
import { useSocket } from "@/context/SocketContext"
import { parseTSConfigToMonacoOptions } from "@/lib/tsconfig"
import { DiffBlock, GranularDiffState, LineChange, Sandbox, TFile, TFolder, TTab, User } from "@/lib/types"
import {
  cn,
  deepMerge,
  processFileType,
  validateName,
} from "@/lib/utils"
import { Terminal } from "@xterm/xterm"
import {
  ArrowDownToLine,
  ArrowRightToLine,
  FileJson,
  Loader2,
  Sparkles,
  TerminalSquare
} from "lucide-react"
import { useTheme } from "next-themes"
import React from "react"
import { ImperativePanelHandle } from "react-resizable-panels"
import Tab from "../ui/tab"
import AIChat from "./AIChat"
import GenerateInput from "./generate"
// import { Cursors } from "./live/cursors"
import ChangesAlert, { AlertState } from "./changes-alert"
import DisableAccessModal from "./live/disableModal"
import Loading from "./loading"
import PreviewWindow from "./preview"
import Sidebar from "./sidebar"
import Terminals from "./terminals"

export default function CodeEditor({
  userData,
  sandboxData,
}: {
  userData: User
  sandboxData: Sandbox
}) {
  //SocketContext functions and effects
  const { socket, setUserAndSandboxId } = useSocket()
  // theme
  const { resolvedTheme: theme } = useTheme()
  useEffect(() => {
    // Ensure userData.id and sandboxData.id are available before attempting to connect
    if (userData.id && sandboxData.id) {
      // Check if the socket is not initialized or not connected
      if (!socket || (socket && !socket.connected)) {
        // Initialize socket connection
        setUserAndSandboxId(userData.id, sandboxData.id)
      }
    }
  }, [socket, userData.id, sandboxData.id, setUserAndSandboxId])

  // This dialog is used to alert the user that the project has timed out
  const [timeoutDialog, setTimeoutDialog] = useState(false)

  // This heartbeat is critical to preventing the E2B sandbox from timing out
  useEffect(() => {
    // 10000 ms = 10 seconds
    const interval = setInterval(async () => {
      try {
        const response = await apiClient.file.heartbeat.$post({
          json: {
            projectId: sandboxData.id,
            isOwner: sandboxData.userId === userData.id,
          },
        })
        if (response.status === 200) {
          const data = await response.json()
          if (!data.success) {
            setTimeoutDialog(true)
          }
        }
      } catch (error) {
        console.error("Heartbeat error:", error)
        setTimeoutDialog(true)
      }
    }, 10000)
    return () => clearInterval(interval)
  }, [sandboxData.id, sandboxData.userId === userData.id])

  //Preview Button state
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(true)
  const [disableAccess, setDisableAccess] = useState({
    isDisabled: false,
    message: "",
  })

  // Alert State
  const [showAlert, setShowAlert] = useState<AlertState>(null)

  // Layout state
  const [isHorizontalLayout, setIsHorizontalLayout] = useState(false)
  const [previousLayout, setPreviousLayout] = useState(false)

  // AI Chat state
  const [isAIChatOpen, setIsAIChatOpen] = useState(false)

  // Animation frame management to prevent race conditions
  const animationFrameRef = useRef<number>()

  // File state
  const [files, setFiles] = useState<(TFolder | TFile)[]>([])
  const [tabs, setTabs] = useState<TTab[]>([])
  const [activeFileId, setActiveFileId] = useState<string>("")
  const [activeFileContent, setActiveFileContent] = useState("")
  const [deletingFolderId, setDeletingFolderId] = useState("")
  // Added this state to track the most recent content for each file
  const [fileContents, setFileContents] = useState<Record<string, string>>({})

  // Apply Button merger decoration state - now per file
  const [mergeDecorations, setMergeDecorations] = useState<
    monaco.editor.IModelDeltaDecoration[]
  >([])
  const [mergeDecorationsCollection, setMergeDecorationsCollection] =
    useState<monaco.editor.IEditorDecorationsCollection>()
  
  // Per-file diff state storage
  const fileDiffStates = useRef<Map<string, {
    granularState: GranularDiffState | undefined
    decorationsCollection: monaco.editor.IEditorDecorationsCollection | undefined
  }>>(new Map())

  // Editor state
  const [editorLanguage, setEditorLanguage] = useState("plaintext")
  const [cursorLine, setCursorLine] = useState(0)
  const [editorRef, setEditorRef] =
    useState<monaco.editor.IStandaloneCodeEditor>()

  // AI Copilot state
  const [generate, setGenerate] = useState<{
    show: boolean
    id: string
    line: number
    widget: monaco.editor.IContentWidget | undefined
    pref: monaco.editor.ContentWidgetPositionPreference[]
    width: number
  }>({ show: false, line: 0, id: "", widget: undefined, pref: [], width: 0 })
  const [decorations, setDecorations] = useState<{
    options: monaco.editor.IModelDeltaDecoration[]
    instance: monaco.editor.IEditorDecorationsCollection | undefined
  }>({ options: [], instance: undefined })
  const [isSelected, setIsSelected] = useState(false)
  const [showSuggestion, setShowSuggestion] = useState(false)
  // Terminal state
  const [terminals, setTerminals] = useState<
    {
      id: string
      terminal: Terminal | null
    }[]
  >([])

  // Preview state
  const [previewURL, setPreviewURL] = useState<string>("")

  const loadPreviewURL = (url: string) => {
    // This will cause a reload if previewURL changed.
    setPreviewURL(url)
    // If the URL didn't change, still reload the preview.
    previewWindowRef.current?.refreshIframe()
  }

  const isOwner = sandboxData.userId === userData.id
  const clerk = useClerk()
  const hasUnsavedFiles = tabs.some((tab) => !tab.saved)

  // console.log("has Unsaved: ", hasUnsavedFiles, tabs)
  // // Liveblocks hooks
  // const room = useRoom()
  // const [provider, setProvider] = useState<TypedLiveblocksProvider>()
  // const userInfo = useSelf((me) => me.info)

  // // Liveblocks providers map to prevent reinitializing providers
  // type ProviderData = {
  //   provider: LiveblocksProvider<never, never, never, never>
  //   yDoc: Y.Doc
  //   yText: Y.Text
  //   binding?: MonacoBinding
  //   onSync: (isSynced: boolean) => void
  // }
  // const providersMap = useRef(new Map<string, ProviderData>())

  // Refs for libraries / features
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const monacoRef = useRef<typeof monaco | null>(null)
  const generateRef = useRef<HTMLDivElement>(null)
  const suggestionRef = useRef<HTMLDivElement>(null)
  const generateWidgetRef = useRef<HTMLDivElement>(null)
  const { previewPanelRef } = usePreview()
  const editorPanelRef = useRef<ImperativePanelHandle>(null)
  const previewWindowRef = useRef<{ refreshIframe: () => void }>(null)

  // Ref to store the last copied range in the editor to be used in the AIChat component
  const lastCopiedRangeRef = useRef<{
    startLine: number
    endLine: number
  } | null>(null)

  // Direct selection setting without debouncing  
  const setSelectionState = (value: boolean) => {
    setIsSelected(value)
  }
  // Pre-mount editor keybindings
  const handleEditorWillMount: BeforeMount = (monaco) => {
    monaco.editor.addKeybindingRules([
      {
        keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyG,
        command: "null",
      },
    ])
  }

  // Post-mount editor keybindings and actions
  const handleEditorMount: OnMount = async (editor, monaco) => {
    setEditorRef(editor)
    monacoRef.current = monaco
    /**
     * Sync all the models to the worker eagerly.
     * This enables intelliSense for all files without needing an `addExtraLib` call.
     */
    monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true)
    monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true)

    monaco.languages.typescript.typescriptDefaults.setCompilerOptions(
      defaultCompilerOptions
    )
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions(
      defaultCompilerOptions
    )
    const fetchFileContent = (fileId: string): Promise<string> => {
      return new Promise((resolve) => {
        apiClient.file
          .$get({
            query: {
              fileId,
              projectId: sandboxData.id,
            },
          })
          .then(async (res) => {
            if (res.status === 200) {
              resolve(await res.json())
            }
          })
      })
    }
    const loadTSConfig = async (files: (TFolder | TFile)[]) => {
      const tsconfigFiles = files.filter((file) =>
        file.name.endsWith("tsconfig.json")
      )
      let mergedConfig: any = { compilerOptions: {} }

      for (const file of tsconfigFiles) {
        const content = await fetchFileContent(file.id)

        try {
          let tsConfig = JSON.parse(content)

          // Handle references
          if (tsConfig.references) {
            for (const ref of tsConfig.references) {
              const path = ref.path.replace("./", "")
              const refContent = await fetchFileContent(path)
              const referenceTsConfig = JSON.parse(refContent)

              // Merge configurations
              mergedConfig = deepMerge(mergedConfig, referenceTsConfig)
            }
          }

          // Merge current file's config
          mergedConfig = deepMerge(mergedConfig, tsConfig)
        } catch (error) {
          console.error("Error parsing TSConfig:", error)
        }
      }
      // Apply merged compiler options
      if (mergedConfig.compilerOptions) {
        const updatedOptions = parseTSConfigToMonacoOptions({
          ...defaultCompilerOptions,
          ...mergedConfig.compilerOptions,
        })
        monaco.languages.typescript.typescriptDefaults.setCompilerOptions(
          updatedOptions
        )
        monaco.languages.typescript.javascriptDefaults.setCompilerOptions(
          updatedOptions
        )
      }

      // Store the last copied range in the editor to be used in the AIChat component
      editor.onDidChangeCursorSelection((e) => {
        const selection = editor.getSelection()
        if (selection) {
          lastCopiedRangeRef.current = {
            startLine: selection.startLineNumber,
            endLine: selection.endLineNumber,
          }
        }
      })
    }

    // Call the function with your file structure
    await loadTSConfig(files)

    editor.onDidChangeCursorPosition((e) => {
      setIsSelected(false)
      const selection = editor.getSelection()
      if (selection !== null) {
        const hasSelection = !selection.isEmpty()
        setSelectionState(hasSelection)
        setShowSuggestion(hasSelection)
      }
      const { column, lineNumber } = e.position
      if (lineNumber === cursorLine) return
      setCursorLine(lineNumber)

      const model = editor.getModel()
      const endColumn = model?.getLineContent(lineNumber).length || 0

      setDecorations((prev) => {
        return {
          ...prev,
          options: [
            {
              range: new monaco.Range(
                lineNumber,
                column,
                lineNumber,
                endColumn
              ),
              options: {
                afterContentClassName: "inline-decoration",
              },
            },
          ],
        }
      })
    })

    editor.onDidBlurEditorText((e) => {
      setDecorations((prev) => {
        return {
          ...prev,
          options: [],
        }
      })
    })

    editor.addAction({
      id: "generate",
      label: "Generate",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyG],
      precondition:
        "editorTextFocus && !suggestWidgetVisible && !renameInputVisible && !inSnippetMode && !quickFixWidgetVisible",
      run: handleAiEdit,
    })
  }
  const handleAiEdit = React.useCallback(
    (editor?: monaco.editor.ICodeEditor) => {
      console.log("editorRef", editorRef)
      const e = editor ?? editorRef
      if (!e) return
      const selection = e.getSelection()
      console.log("selection", selection)
      if (!selection) return
      const pos = selection.getPosition()
      const start = selection.getStartPosition()
      const end = selection.getEndPosition()
      let pref: monaco.editor.ContentWidgetPositionPreference
      let id = ""
      const isMultiline = start.lineNumber !== end.lineNumber
      if (isMultiline) {
        if (pos.lineNumber <= start.lineNumber) {
          pref = monaco.editor.ContentWidgetPositionPreference.ABOVE
        } else {
          pref = monaco.editor.ContentWidgetPositionPreference.BELOW
        }
      } else {
        pref = monaco.editor.ContentWidgetPositionPreference.ABOVE
      }
      e.changeViewZones(function (changeAccessor) {
        if (!generateRef.current) return
        if (pref === monaco.editor.ContentWidgetPositionPreference.ABOVE) {
          id = changeAccessor.addZone({
            afterLineNumber: start.lineNumber - 1,
            heightInLines: 2,
            domNode: generateRef.current,
          })
        }
      })
      setGenerate((prev) => {
        return {
          ...prev,
          show: true,
          pref: [pref],
          id,
        }
      })
    },
    [editorRef]
  )

  // Handle block accept/reject actions with event sourcing pattern
  const handleBlockAction = useCallback(
    (blockId: string, action: 'accept' | 'reject') => {
      if (!editorRef || !activeFileId) return
      const model = editorRef.getModel()
      if (!model) return

      // Get diff state for current file
      const fileState = fileDiffStates.current.get(activeFileId)
      const granularState = fileState?.granularState
      if (!granularState) return

      // Create command object for undo/redo capability
      const command = {
        id: `${action}-${blockId}`,
        timestamp: Date.now(),
        blockId,
        action,
        previousState: granularState
      }

      try {
        // Process changes in dependency order to maintain consistency
        const updatedBlocks = granularState.blocks.map(block => {
          if (block.id === blockId) {
            return {
              ...block,
              changes: block.changes.map(change => ({
                ...change, 
                accepted: action === 'accept',
                timestamp: command.timestamp
              }))
            }
          }
          return block
        })

        // Calculate line number offsets for subsequent blocks
        let lineOffset = 0
        const processedBlocks = updatedBlocks.map(block => {
          if (block.id === blockId) {
            // Calculate offset based on accepted/rejected changes
            const addedLines = block.changes.filter(c => c.type === 'added').length
            const removedLines = block.changes.filter(c => c.type === 'removed').length
            
            if (action === 'accept') {
              // Accept: remove old lines, keep new lines
              lineOffset += addedLines - removedLines
            } else {
              // Reject: keep old lines, remove new lines
              lineOffset -= addedLines  // Don't add the new lines
              // Removed lines stay in place, so no adjustment needed for them
            }
          } else {
            // Adjust line numbers for blocks after the current one
            const adjustedChanges = block.changes.map(change => ({
              ...change,
              lineNumber: change.lineNumber + lineOffset
            }))
            
            return {
              ...block,
              changes: adjustedChanges,
              startLine: block.startLine + lineOffset,
              endLine: block.endLine + lineOffset
            }
          }
          return block
        })

        // Create new immutable state
        const updatedState: GranularDiffState = {
          ...granularState,
          blocks: processedBlocks,
          allAccepted: processedBlocks.every(block => 
            block.changes.every(change => change.accepted === true)
          )
        }

        // Store state atomically per file
        ;(model as any).granularDiffState = updatedState
        
        // Update per-file state
        const currentFileState = fileDiffStates.current.get(activeFileId)
        if (currentFileState) {
          currentFileState.granularState = updatedState
        }

        // Rebuild editor content using optimized algorithm
        rebuildEditorFromBlockState(updatedState)
        
        // Check for remaining pending blocks
        const hasPendingBlocks = processedBlocks.some(block => 
          block.changes.some(c => c.accepted === null)
        )

        // Use requestAnimationFrame for smooth UI updates with race condition protection
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
        const currentFileVersion = (model as any).fileVersion
        animationFrameRef.current = requestAnimationFrame(() => {
          // Verify we're still on the same file version to prevent race conditions
          if ((model as any).fileVersion === currentFileVersion) {
            if (hasPendingBlocks) {
              // Re-add widgets only for pending blocks
              addBlockControlWidgets(updatedState, handleBlockAction)
            } else {
              // Clean up all widgets when complete
              cleanupBlockWidgets()
              
              // Trigger completion callback if all changes accepted
              if (updatedState.allAccepted) {
                onDiffComplete?.(model.getValue())
              }
            }
          }
          animationFrameRef.current = undefined
        })

        // Update file state efficiently
        updateFileState(model.getValue())
        
      } catch (error) {
        console.error('Failed to process block action:', error)
        // Rollback on error
        ;(model as any).granularDiffState = granularState
        toast.error('Failed to apply changes. Please try again.')
      }
    },
    [editorRef, activeFileId]
  )

  // Enhanced handle apply code with granular diff tracking using proven diff algorithms
  const handleApplyCode = useCallback(
    (mergedCode: string, originalCode: string) => {
      if (!editorRef) return
      const model = editorRef.getModel()
      if (!model) return
      
      // Store original content for rollback capability
      ;(model as any).originalContent = originalCode

      // Normalize line endings for cross-platform compatibility
      const normalizeLineEndings = (str: string) => str.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      const normalizedOriginal = normalizeLineEndings(originalCode)
      const normalizedMerged = normalizeLineEndings(mergedCode)

      // Use Myers algorithm through diffLines for optimal performance
      const changes = diffLines(normalizedOriginal, normalizedMerged, { ignoreWhitespace: false })
      
      // Coordinate system management: separate document from viewport coordinates
      const decorations: monaco.editor.IModelDeltaDecoration[] = []
      const documentLines: string[] = []
      const diffBlocks: DiffBlock[] = []
      const lineMapping = new Map<number, number>() // original -> document line mapping
      
      let documentLineNumber = 1
      let originalLineNumber = 1
      let currentBlockId = ""
      let currentBlock: LineChange[] = []
      let blockStartOriginalLine = 1

      const generateId = () => `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      // Helper to finalize current block
              const finalizeCurrentBlock = () => {
          if (currentBlock.length > 0) {
            const blockType = currentBlock.some(c => c.type === 'added') && currentBlock.some(c => c.type === 'removed') 
              ? 'modification' 
              : currentBlock[0].type === 'added' ? 'addition' : 'deletion'
              
            // Calculate the start/end lines based on what's actually in the document
            const allDocumentLines = currentBlock
              .filter(c => c.lineNumber > 0)
              .map(c => c.lineNumber)
            
            let startLine: number, endLine: number
            
            if (allDocumentLines.length > 0) {
              startLine = Math.min(...allDocumentLines)
              endLine = Math.max(...allDocumentLines)
            } else {
              // For blocks with only removed content (that might be re-added later)
              startLine = documentLineNumber
              endLine = documentLineNumber
            }
            
            const diffBlock: DiffBlock = {
              id: currentBlockId,
              startLine,
              endLine,
              changes: currentBlock,
              type: blockType,
              originalStartLine: blockStartOriginalLine
            }
            diffBlocks.push(diffBlock)
            currentBlock = []
            currentBlockId = ""
          }
        }

      // Process changes in order to maintain dependency chain
      for (let i = 0; i < changes.length; i++) {
        const change = changes[i]
        const lines = change.value.split('\n')
        // Only remove the last empty line if it's from a trailing newline
        if (lines.length > 1 && lines[lines.length - 1] === '') {
          lines.pop()
        }

        if (change.added || change.removed) {
          // Check if we need to start a new block
          const isNewBlock = currentBlock.length === 0 || 
            (i > 0 && changes[i-1].added === undefined && changes[i-1].removed === undefined)
          
          if (isNewBlock) {
            finalizeCurrentBlock() // Finalize any existing block
            currentBlockId = generateId()
            blockStartOriginalLine = originalLineNumber
          }

                  // Process each line with proper coordinate tracking
        lines.forEach((line: string, lineIdx: number) => {
          if (change.removed) {
            // ADD REMOVED LINES TO THE DOCUMENT SO THEY'RE VISIBLE!
            documentLines.push(line)
            
            const lineChange: LineChange = {
              id: `${currentBlockId}-del-${lineIdx}`,
              lineNumber: documentLineNumber, // Now has a real line number
              type: 'removed',
              content: line,
              blockId: currentBlockId,
              accepted: null,
              originalLineNumber: originalLineNumber + lineIdx
            }
            currentBlock.push(lineChange)
            
            // Add red decoration for removed line
            decorations.push({
              range: new monaco.Range(documentLineNumber, 1, documentLineNumber, Math.max(1, line.length)),
              options: {
                isWholeLine: true,
                className: "removed-line-decoration",
                glyphMarginClassName: "removed-line-glyph",
                linesDecorationsClassName: "removed-line-number",
                minimap: { color: "rgba(255, 0, 0, 0.3)", position: 2 },
                hoverMessage: { value: `Removed line ${lineIdx + 1} in block ${currentBlock.length}` }
              }
            })
            
            lineMapping.set(originalLineNumber + lineIdx, documentLineNumber)
            documentLineNumber++
          } else if (change.added) {
            documentLines.push(line)
            
            const lineChange: LineChange = {
              id: `${currentBlockId}-add-${lineIdx}`,
              lineNumber: documentLineNumber,
              type: 'added',
              content: line,
              blockId: currentBlockId,
              accepted: null,
              originalLineNumber: originalLineNumber
            }
            currentBlock.push(lineChange)
            
            decorations.push({
              range: new monaco.Range(documentLineNumber, 1, documentLineNumber, Math.max(1, line.length)),
              options: {
                isWholeLine: true,
                className: "added-line-decoration",
                glyphMarginClassName: "added-line-glyph",
                linesDecorationsClassName: "added-line-number",
                minimap: { color: "rgba(0, 255, 0, 0.3)", position: 2 },
                hoverMessage: { value: `Added line ${lineIdx + 1} in block ${currentBlock.length}` }
              }
            })
            documentLineNumber++
          }
        })

          // Update original line counter only for removed lines
          if (change.removed) {
            originalLineNumber += lines.length
          }
          // Note: We don't increment for added lines since they don't consume original line numbers
          
        } else {
          // Unchanged content - finalize any current block first
          finalizeCurrentBlock()

          // Add unchanged lines with proper mapping
          lines.forEach((line: string, idx: number) => {
            documentLines.push(line)
            lineMapping.set(originalLineNumber + idx, documentLineNumber)
            documentLineNumber++
          })
          originalLineNumber += lines.length
        }
      }

      // Handle final block if exists
      finalizeCurrentBlock()

      // Merge adjacent blocks that should be grouped together
      const mergedBlocks: DiffBlock[] = []
      let currentMergedBlock: DiffBlock | null = null

      for (let i = 0; i < diffBlocks.length; i++) {
        const block = diffBlocks[i]
        
        // Check if this block should be merged with the previous one
        if (currentMergedBlock && shouldMergeBlocks(currentMergedBlock, block)) {
          // Merge blocks
          currentMergedBlock.changes.push(...block.changes)
          currentMergedBlock.endLine = Math.max(currentMergedBlock.endLine, block.endLine)
          
          // Update block type for merged blocks
          const hasAdded = currentMergedBlock.changes.some(c => c.type === 'added')
          const hasRemoved = currentMergedBlock.changes.some(c => c.type === 'removed')
          
          if (hasAdded && hasRemoved) {
            currentMergedBlock.type = 'modification'
          } else if (hasAdded) {
            currentMergedBlock.type = 'addition'
          } else {
            currentMergedBlock.type = 'deletion'
          }
        } else {
          // Start a new merged block
          if (currentMergedBlock) {
            mergedBlocks.push(currentMergedBlock)
          }
          currentMergedBlock = { ...block, changes: [...block.changes] }
        }
      }

      // Add the last block
      if (currentMergedBlock) {
        mergedBlocks.push(currentMergedBlock)
      }

      // Helper function to determine if blocks should be merged
      function shouldMergeBlocks(block1: DiffBlock, block2: DiffBlock): boolean {
        // Merge if blocks are within 3 lines of each other and both are small changes
        const distance = block2.startLine - block1.endLine
        const block1Size = block1.changes.length
        const block2Size = block2.changes.length
        
        // Add context check - don't merge if there's meaningful unchanged content between
        if (distance > 1) {
          // Check if the lines between blocks are just whitespace
          const linesBetween = documentLines.slice(block1.endLine, block2.startLine - 1)
          const hasContentBetween = linesBetween.some(line => line.trim().length > 0)
          if (hasContentBetween) return false
        }
        
        return (
          distance <= 3 && // Close proximity
          (block1Size <= 5 || block2Size <= 5) && // At least one block is small
          block1Size + block2Size <= 10 // Combined size is reasonable
        )
      }

      // Create immutable granular diff state using event sourcing pattern
      const granularDiffState: GranularDiffState = {
        blocks: mergedBlocks,
        originalCode: normalizedOriginal,
        mergedCode: normalizedMerged,
        allAccepted: false,
        timestamp: Date.now(),
        lineMapping,
        version: 1
      }
      
      // Add file version for race condition protection
      const fileVersion = Date.now()
      ;(model as any).fileVersion = fileVersion
      
      // Store state per file instead of globally
      fileDiffStates.current.set(activeFileId, {
        granularState: granularDiffState,
        decorationsCollection: undefined // Will be set below
      })
      
      // Also store on model for backward compatibility
      ;(model as any).granularDiffState = granularDiffState
      ;(model as any).diffVersion = granularDiffState.version

      // Apply content and decorations atomically
      model.setValue(documentLines.join("\n"))
      
      // Use Monaco's decoration system for efficient updates
      const decorationsCollection = editorRef.createDecorationsCollection(decorations)
      setMergeDecorationsCollection(decorationsCollection)
      
      // Store decorations collection per file
      const fileState = fileDiffStates.current.get(activeFileId)
      if (fileState) {
        fileState.decorationsCollection = decorationsCollection
      }

      // Add widget controls with proper positioning and race condition protection
      requestAnimationFrame(() => {
        // Verify we're still on the same file version to prevent race conditions
        if ((model as any).fileVersion === fileVersion) {
          addBlockControlWidgets(granularDiffState, handleBlockAction)
        }
      })
    },
    [editorRef, handleBlockAction]
  )

  // Helper function to clean up block widgets
  const cleanupBlockWidgets = useCallback(() => {
    if (!editorRef) return
    const existingWidgets = (editorRef as any).blockControlWidgets || []
    existingWidgets.forEach((widget: any) => {
      const domNode = widget.getDomNode()
      if (domNode && domNode.parentNode) {
        // Clean up event listeners on buttons to prevent memory leaks
        const buttons = domNode.querySelectorAll('button')
        buttons.forEach((button: any) => {
          if (button.cleanup) {
            button.cleanup()
          }
        })
        domNode.parentNode.removeChild(domNode)
      }
      editorRef.removeContentWidget(widget)
    })
    ;(editorRef as any).blockControlWidgets = []
  }, [editorRef])

  // Helper function to update file state
  const updateFileState = useCallback((content: string) => {
    if (!activeFileId) return
    
    // Batch state updates for performance
    setFileContents((prev) => ({
      ...prev,
      [activeFileId]: content,
    }))
    
    setActiveFileContent(content)
    
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeFileId ? { ...tab, saved: false } : tab
      )
    )
  }, [activeFileId, setFileContents, setActiveFileContent, setTabs])

  // Optional completion callback
  const onDiffComplete = useCallback((finalContent: string) => {
    console.log('Diff process completed with final content length:', finalContent.length)
  }, [])



  // Helper function to find a line in the editor by content
  const findLineInEditor = (lines: string[], content: string, hint: number): number => {
    console.log(`Searching for content: "${content.substring(0, 50)}..." with hint ${hint}`)
    
    // First try exact match near hint
    const searchRadius = 5
    const startSearch = Math.max(0, hint - searchRadius - 1)
    const endSearch = Math.min(lines.length, hint + searchRadius)
    
    for (let i = startSearch; i < endSearch; i++) {
      if (lines[i] === content) {
        console.log(`Found exact match at line ${i + 1} (near hint)`)
        return i + 1
      }
    }
    
    // Try exact match globally
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] === content) {
        console.log(`Found exact match at line ${i + 1} (global)`)
        return i + 1
      }
    }
    
    // Try trimmed match
    const trimmedContent = content.trim()
    if (trimmedContent) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === trimmedContent) {
          console.log(`Found trimmed match at line ${i + 1}`)
          return i + 1
        }
      }
    }
    
    // Try partial match only for meaningful content (avoid false positives with "...")
    if (trimmedContent && trimmedContent.length > 5) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(trimmedContent) && lines[i].trim().length > 5) {
          console.log(`Found partial match at line ${i + 1}`)
          return i + 1
        }
      }
    }
    
    console.log(`No match found for content: "${content.substring(0, 30)}..."`)
    return -1
  }

  // Add floating block control widgets with improved positioning and anchoring
  const addBlockControlWidgets = useCallback(
    (granularState: GranularDiffState, blockActionHandler: (blockId: string, action: 'accept' | 'reject') => void) => {
      if (!editorRef || !monacoRef.current) return

      // Clean up existing widgets using batched operations
      cleanupBlockWidgets()

      const widgets: any[] = []
      const model = editorRef.getModel()
      if (!model) return

      const currentContent = model.getValue()
      const currentLines = currentContent.split('\n')

      granularState.blocks.forEach((block, index) => {
        // Check if block needs processing (has pending changes)
        const hasPendingChanges = block.changes.some(c => c.accepted === null)
        
        if (hasPendingChanges) {
          // Find ANY visible change from this block to position the widget
          let targetLineNumber = -1
          
          // Position widget strategically based on block type
          if (block.type === 'modification') {
            // For modification blocks, position after the last removed line for clarity
            const removedLines = block.changes
              .filter(c => c.type === 'removed' && c.accepted === null && c.lineNumber > 0)
              .map(c => c.lineNumber)
            
            if (removedLines.length > 0) {
              targetLineNumber = Math.max(...removedLines)
              console.log(`Positioning widget for modification block ${block.id} after last removed line: ${targetLineNumber}`)
            }
          }
          
          // If not positioned yet, look for any visible change
          if (targetLineNumber === -1) {
            const meaningfulChanges = block.changes
              .filter(c => c.accepted === null && c.lineNumber > 0)
              .sort((a, b) => {
                // Prioritize non-empty, non-whitespace content
                const aScore = a.content.trim().length
                const bScore = b.content.trim().length
                return bScore - aScore
              })

            for (const change of meaningfulChanges) {
              // Skip empty or very generic content
              const trimmedContent = change.content.trim()
              if (!trimmedContent || trimmedContent === '...' || trimmedContent.length < 3) {
                continue
              }

              // Use the direct line number since all changes now have real positions
              if (change.lineNumber > 0) {
                targetLineNumber = change.lineNumber
                console.log(`Using direct line number for ${change.type} content in block ${block.id}: line ${targetLineNumber}`)
                break
              }

              // Fallback: search for the content
              const foundLine = findLineInEditor(currentLines, change.content, 1)
              if (foundLine !== -1) {
                targetLineNumber = foundLine
                console.log(`Found line for block ${block.id}: content="${change.content.substring(0, 50)}..." at line ${foundLine}`)
                break // Use the first match we find
              }
            }
          }

          // If no meaningful content found, try any pending change
          if (targetLineNumber === -1) {
            for (const change of block.changes) {
              if (change.accepted === null && change.lineNumber > 0) {
                targetLineNumber = change.lineNumber
                console.log(`Found fallback line for block ${block.id}: content="${change.content.substring(0, 30)}..." at line ${targetLineNumber}`)
                break
              }
            }
          }

          // Fallback: if we can't find any content, use the block's recorded position
          if (targetLineNumber === -1) {
            // For blocks with only removed lines, find the insertion point based on original line numbers
            const removedChanges = block.changes.filter(c => c.type === 'removed')
            if (removedChanges.length > 0) {
              // Use the minimum original line number as a reference point
              const originalLineNumbers = removedChanges.map(c => c.originalLineNumber).filter(n => n !== undefined) as number[]
              if (originalLineNumbers.length > 0) {
                const minOriginalLine = Math.min(...originalLineNumbers)
                // Try to find a reasonable insertion point near the original location
                targetLineNumber = Math.max(1, Math.min(minOriginalLine, currentLines.length))
                console.log(`Using original line reference for removed content in block ${block.id}: line ${targetLineNumber}`)
              } else {
                targetLineNumber = Math.max(1, Math.min(block.startLine, currentLines.length))
                console.log(`Using fallback position for block ${block.id}: line ${targetLineNumber}`)
              }
            } else {
              targetLineNumber = Math.max(1, Math.min(block.startLine, currentLines.length))
              console.log(`Using fallback position for block ${block.id}: line ${targetLineNumber}`)
            }
          }

          // Create widget with proper positioning
          const widgetElement = createBlockWidget(block, index, blockActionHandler)
          
          // Create the widget with smart positioning
          const widget = {
            getDomNode: () => widgetElement,
            getId: () => `block-control-${block.id}`,
            getPosition: () => {
              try {
                const currentModel = editorRef.getModel()
                if (!currentModel) return null
                
                // Ensure we're within bounds
                const lineCount = currentModel.getLineCount()
                const actualLine = Math.max(1, Math.min(targetLineNumber, lineCount))
                const lineContent = currentModel.getLineContent(actualLine) || ''
                
                // Position widget right after the line content with minimal padding
                const contentLength = lineContent.length
                const column = Math.max(contentLength + 3, 10) // Just 3 spaces after content
                
                console.log(`Positioning widget for block ${block.id} at line ${actualLine}, column ${column} (content length: ${contentLength})`)
                
                return {
                  position: {
                    lineNumber: actualLine,
                    column: column
                  },
                  preference: [
                    monaco.editor.ContentWidgetPositionPreference.BELOW,
                    monaco.editor.ContentWidgetPositionPreference.ABOVE,
                    monaco.editor.ContentWidgetPositionPreference.EXACT
                  ]
                }
              } catch (error) {
                console.warn('Widget positioning error:', error)
                return {
                  position: { lineNumber: 1, column: 80 },
                  preference: [monaco.editor.ContentWidgetPositionPreference.EXACT]
                }
              }
            },
            allowEditorOverflow: true,
            suppressMouseDown: false
          }

          // Add widget with error handling
          try {
            editorRef.addContentWidget(widget)
            widgets.push(widget)
            console.log(`Added widget for block ${block.id} at target line ${targetLineNumber}`)
          } catch (error) {
            console.error(`Failed to add widget for block ${block.id}:`, error)
          }
        }
      })

      // Store widgets for cleanup with metadata
      ;(editorRef as any).blockControlWidgets = widgets
      ;(editorRef as any).widgetMetadata = {
        timestamp: Date.now(),
        count: widgets.length,
        stateVersion: granularState.version || 1
      }
    },
    [editorRef, monacoRef, cleanupBlockWidgets]
  )

  // Create block widget DOM element with optimized styling
  const createBlockWidget = useCallback((
    block: DiffBlock, 
    index: number, 
    blockActionHandler: (blockId: string, action: 'accept' | 'reject') => void
  ) => {
    const widgetElement = document.createElement('div')
    widgetElement.className = 'block-controls-widget'
    widgetElement.style.cssText = `
      display: inline-flex;
      flex-direction: row;
      align-items: center;
      border: 1px solid hsl(var(--border));
      background: hsl(var(--background));
      border-radius: 4px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.1);
      padding: 2px;
      font-family: var(--font-sans);
      z-index: 1000;
      user-select: none;
      pointer-events: auto;
      font-size: 11px;
      white-space: nowrap;
      gap: 2px;
      min-width: fit-content;
    `

    // Create buttons with improved accessibility
    const acceptBtn = createActionButton('accept', block.id, index + 1, blockActionHandler)
    const rejectBtn = createActionButton('reject', block.id, index + 1, blockActionHandler)
    
    widgetElement.appendChild(acceptBtn)
    widgetElement.appendChild(rejectBtn)
    
    return widgetElement
  }, [])

  // Create action button with consistent styling and behavior
  const createActionButton = useCallback((
    action: 'accept' | 'reject',
    blockId: string,
    blockNumber: number,
    handler: (blockId: string, action: 'accept' | 'reject') => void
  ) => {
    const button = document.createElement('button')
    const isAccept = action === 'accept'
    const color = isAccept ? '#22c55e' : '#ef4444'
    const icon = isAccept 
      ? 'M5 13l4 4L19 7' // checkmark
      : 'M6 18L18 6M6 6l12 12' // x mark
    
    button.className = `${action}-block-btn`
    button.dataset.blockId = blockId
    button.title = `${isAccept ? 'Accept' : 'Reject'} Block ${blockNumber}`
    button.style.cssText = `
      display: inline-flex;
      align-items: center;
      padding: 4px 6px;
      border: none;
      background: transparent;
      cursor: pointer;
      border-radius: 4px;
      font-size: 12px;
      color: hsl(var(--foreground));
      transition: background-color 0.15s ease;
      white-space: nowrap;
      flex-shrink: 0;
    `
    
    button.innerHTML = `
      <svg style="width: 14px; height: 14px; color: ${color}; flex-shrink: 0;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${icon}"></path>
      </svg>
      <span style="margin-left: 3px; font-weight: 500; flex-shrink: 0;">${blockNumber}</span>
    `
    
    // Create event handler functions to store references for cleanup
    const handleClick = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
      try {
        handler(blockId, action)
      } catch (error) {
        console.error(`Failed to ${action} block:`, error)
        toast.error(`Failed to ${action} changes. Please try again.`)
      }
    }

    const handleMouseEnter = () => {
      button.style.backgroundColor = `rgba(${isAccept ? '34, 197, 94' : '239, 68, 68'}, 0.1)`
    }

    const handleMouseLeave = () => {
      button.style.backgroundColor = 'transparent'
    }

    // Add event listeners
    button.addEventListener('click', handleClick)
    button.addEventListener('mouseenter', handleMouseEnter)
    button.addEventListener('mouseleave', handleMouseLeave)

    // Store cleanup function on the button element for memory management
    ;(button as any).cleanup = () => {
      button.removeEventListener('click', handleClick)
      button.removeEventListener('mouseenter', handleMouseEnter)
      button.removeEventListener('mouseleave', handleMouseLeave)
    }
    
    return button
  }, [])

  // Updated rebuild function that properly shows all pending changes
  const rebuildEditorFromBlockState = useCallback(
    (granularState: GranularDiffState) => {
      if (!editorRef || !monacoRef.current) return
      const model = editorRef.getModel()
      if (!model) return

      try {
        // Build content by processing the original diff and applying block states
        const visibleLines: Array<{content: string, decoration?: monaco.editor.IModelDecorationOptions}> = []
        
        // Re-run the diff to get the original change structure
        const changes = diffLines(granularState.originalCode, granularState.mergedCode, { ignoreWhitespace: false })
        
        // Create a map of all changes by unique ID for reliable lookup
        const changeMap = new Map<string, LineChange>()
        granularState.blocks.forEach(block => {
          block.changes.forEach(change => {
            changeMap.set(change.id, change)
          })
        })
        
        for (const change of changes) {
          const lines = change.value.split('\n')
          // Only remove the last empty line if it's from a trailing newline
          if (lines.length > 1 && lines[lines.length - 1] === '') {
            lines.pop()
          }
          
          if (change.removed) {
            // For removed lines, always show them when pending or rejected
            lines.forEach(line => {
              // Find matching change by content and type
              const lineChange = Array.from(changeMap.values()).find(c => 
                c.type === 'removed' && c.content === line
              )
              
              if (lineChange?.accepted === true) {
                // Accepted removal - don't show the line
                return
              } else if (lineChange?.accepted === false) {
                // Rejected removal - show without decoration
                visibleLines.push({ content: line })
              } else {
                // Pending removal - show with red decoration
                visibleLines.push({
                  content: line,
                  decoration: {
                    isWholeLine: true,
                    className: "removed-line-decoration",
                    glyphMarginClassName: "removed-line-glyph", 
                    linesDecorationsClassName: "removed-line-number",
                    minimap: { color: "rgba(255, 0, 0, 0.3)", position: 2 },
                    hoverMessage: { value: "Pending removal - click to accept/reject" }
                  }
                })
              }
            })
          } else if (change.added) {
            // For added lines, show them when pending or accepted
            lines.forEach(line => {
              // Find matching change by content and type
              const lineChange = Array.from(changeMap.values()).find(c => 
                c.type === 'added' && c.content === line
              )
              
              if (lineChange?.accepted === false) {
                // Rejected addition - don't show the line
                return
              } else if (lineChange?.accepted === true) {
                // Accepted addition - show without decoration
                visibleLines.push({ content: line })
              } else {
                // Pending addition - show with green decoration
                visibleLines.push({
                  content: line,
                  decoration: {
                    isWholeLine: true,
                    className: "added-line-decoration",
                    glyphMarginClassName: "added-line-glyph",
                    linesDecorationsClassName: "added-line-number", 
                    minimap: { color: "rgba(0, 255, 0, 0.3)", position: 2 },
                    hoverMessage: { value: "Pending addition - click to accept/reject" }
                  }
                })
              }
            })
          } else {
            // Unchanged lines - always show them
            lines.forEach(line => {
              visibleLines.push({ content: line })
            })
          }
        }

        // Build final content and decorations
        const finalContent: string[] = []
        const decorations: monaco.editor.IModelDeltaDecoration[] = []
        
        visibleLines.forEach((line, index) => {
          finalContent.push(line.content)
          if (line.decoration) {
            decorations.push({
              range: new monaco.Range(index + 1, 1, index + 1, Math.max(1, line.content.length + 1)),
              options: line.decoration
            })
          }
        })

              // Apply content and decorations atomically
      model.setValue(finalContent.join('\n'))
      
      // FIXED: Properly clear and update decorations
      // First, clear the existing collection completely
      if (mergeDecorationsCollection) {
        mergeDecorationsCollection.clear()
        // Force Monaco to update by setting to undefined first
        setMergeDecorationsCollection(undefined)
      }
      
      // Then, create new decorations only if there are pending changes
      if (decorations.length > 0) {
        // Use requestAnimationFrame to ensure the clear has been processed
        requestAnimationFrame(() => {
          const newDecorations = editorRef.createDecorationsCollection(decorations)
          setMergeDecorationsCollection(newDecorations)
        })
      }

        // Update state metadata
        ;(model as any).diffVersion = (granularState.version || 1) + 1
        
      } catch (error) {
        console.error('Failed to rebuild editor content:', error)
        toast.error('Failed to update editor content. Please refresh and try again.')
        
        // Fallback: restore original content with all changes visible
        const fallbackContent = granularState.originalCode + '\n\n--- DIFF PROCESSING ERROR ---\n' + granularState.mergedCode
        model.setValue(fallbackContent)
      }
    },
    [editorRef, monacoRef, mergeDecorationsCollection, setMergeDecorationsCollection]
  )

  // Handle accepting all changes from AI chat
  const handleAcceptAllChanges = useCallback(() => {
    if (!editorRef || !activeFileId) return
    
    const model = editorRef.getModel()
    if (!model) return

    // Get diff state for current file
    const fileState = fileDiffStates.current.get(activeFileId)
    const granularState = fileState?.granularState
    
    if (granularState) {
      // Accept all changes in granular mode by updating the state
      const updatedBlocks = granularState.blocks.map((block: any) => ({
        ...block,
        changes: block.changes.map((change: any) => ({
          ...change,
          accepted: true
        }))
      }))

      // Create updated state
      const updatedState = {
        ...granularState,
        blocks: updatedBlocks,
        allAccepted: true
      }

      // Store the updated state temporarily
      ;(model as any).granularDiffState = updatedState

      // Use the existing rebuild function which properly handles decorations
      rebuildEditorFromBlockState(updatedState)
      
      // Clean up widgets since all changes are accepted
      cleanupBlockWidgets()
      
      // Clean up diff state for current file ONLY
      requestAnimationFrame(() => {
        ;(model as any).granularDiffState = undefined
        ;(model as any).originalContent = undefined
        
        // Clear ONLY the current file's state
        fileDiffStates.current.delete(activeFileId)
        
        // Clear decorations for current file
        if (mergeDecorationsCollection) {
          mergeDecorationsCollection.clear()
          setMergeDecorationsCollection(undefined)
        }
      })
    } else if (mergeDecorationsCollection) {
      // Fallback to old behavior
      const lines = model.getValue().split("\n")
      const removedLines = new Set()

      for (let i = 1; i <= lines.length; i++) {
        const lineDecorations = model.getLineDecorations(i)
        if (
          lineDecorations?.some(
            (d: any) => d.options.className === "removed-line-decoration"
          )
        ) {
          removedLines.add(i)
        }
      }

      const finalLines = lines.filter(
        (_: string, index: number) => !removedLines.has(index + 1)
      )
      model.setValue(finalLines.join("\n"))
      
      // Clean up decorations for current file only
      mergeDecorationsCollection.clear()
      setMergeDecorationsCollection(undefined)
      
      // Remove the current file from diff states
      fileDiffStates.current.delete(activeFileId)
    }
  }, [editorRef, mergeDecorationsCollection, setMergeDecorationsCollection, cleanupBlockWidgets, rebuildEditorFromBlockState, activeFileId])

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedFiles) {
        e.preventDefault()
        e.returnValue =
          "You have unsaved changes. Are you sure you want to leave?"
        return e.returnValue
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [hasUnsavedFiles])

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      // Cancel any pending animation frames
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      // Clean up block widgets
      cleanupBlockWidgets()
    }
  }, [cleanupBlockWidgets])

  // Generate widget effect
  useEffect(() => {
    if (generate.show) {
      setShowSuggestion(false)
      editorRef?.changeViewZones(function (changeAccessor) {
        if (!generateRef.current) return
        if (!generate.id) {
          const id = changeAccessor.addZone({
            afterLineNumber: cursorLine,
            heightInLines: 3,
            domNode: generateRef.current,
          })
          setGenerate((prev) => {
            return { ...prev, id, line: cursorLine }
          })
        }
        setGenerate((prev) => {
          return { ...prev, line: cursorLine }
        })
      })

      if (!generateWidgetRef.current) return
      const widgetElement = generateWidgetRef.current

      const contentWidget = {
        getDomNode: () => {
          return widgetElement
        },
        getId: () => {
          return "generate.widget"
        },
        getPosition: () => {
          return {
            position: {
              lineNumber: cursorLine,
              column: 1,
            },
            preference: generate.pref,
          }
        },
      }

      // window width - sidebar width, times the percentage of the editor panel
      const width = editorPanelRef.current
        ? (editorPanelRef.current.getSize() / 100) * (window.innerWidth - 224)
        : 400 //fallback

      setGenerate((prev) => {
        return {
          ...prev,
          widget: contentWidget,
          width,
        }
      })
      editorRef?.addContentWidget(contentWidget)

      if (generateRef.current && generateWidgetRef.current) {
        editorRef?.applyFontInfo(generateRef.current)
        editorRef?.applyFontInfo(generateWidgetRef.current)
      }
    } else {
      editorRef?.changeViewZones(function (changeAccessor) {
        changeAccessor.removeZone(generate.id)
        setGenerate((prev) => {
          return { ...prev, id: "" }
        })
      })

      if (!generate.widget) return
      editorRef?.removeContentWidget(generate.widget)
      setGenerate((prev) => {
        return {
          ...prev,
          widget: undefined,
        }
      })
    }
  }, [generate.show])

  // Suggestion widget effect
  useEffect(() => {
    if (!suggestionRef.current || !editorRef) return
    const widgetElement = suggestionRef.current
    const suggestionWidget: monaco.editor.IContentWidget = {
      getDomNode: () => {
        return widgetElement
      },
      getId: () => {
        return "suggestion.widget"
      },
      getPosition: () => {
        const selection = editorRef?.getSelection()
        const column = Math.max(3, selection?.positionColumn ?? 1)
        let lineNumber = selection?.positionLineNumber ?? 1
        let pref = monaco.editor.ContentWidgetPositionPreference.ABOVE
        if (lineNumber <= 3) {
          pref = monaco.editor.ContentWidgetPositionPreference.BELOW
        }
        return {
          preference: [pref],
          position: {
            lineNumber,
            column,
          },
        }
      },
    }
    if (isSelected) {
      editorRef?.addContentWidget(suggestionWidget)
      editorRef?.applyFontInfo(suggestionRef.current)
    } else {
      editorRef?.removeContentWidget(suggestionWidget)
    }
  }, [isSelected])

  // Decorations effect for generate widget tips
  useEffect(() => {
    if (decorations.options.length === 0) {
      decorations.instance?.clear()
    }

    const model = editorRef?.getModel()
    // added this because it was giving client side exception - Illegal value for lineNumber when opening an empty file
    if (model) {
      const totalLines = model.getLineCount()
      // Check if the cursorLine is a valid number, If cursorLine is out of bounds, we fall back to 1 (the first line) as a default safe value.
      const lineNumber =
        cursorLine > 0 && cursorLine <= totalLines ? cursorLine : 1 // fallback to a valid line number
      // If for some reason the content doesn't exist, we use an empty string as a fallback.
      const line = model.getLineContent(lineNumber) ?? ""
      // Check if the line is not empty or only whitespace (i.e., `.trim()` removes spaces).
      // If the line has content, we clear any decorations using the instance of the `decorations` object.
      // Decorations refer to editor highlights, underlines, or markers, so this clears those if conditions are met.
      if (line.trim() !== "") {
        decorations.instance?.clear()
        return
      }
    }

    if (decorations.instance) {
      decorations.instance.set(decorations.options)
    } else {
      const instance = editorRef?.createDecorationsCollection()
      instance?.set(decorations.options)

      setDecorations((prev) => {
        return {
          ...prev,
          instance,
        }
      })
    }
  }, [decorations.options])

  // Manual save function - only triggered by user action (Ctrl+S)
  const saveFile = useCallback((fileId: string | undefined) => {
    if (!fileId) return
    
    // Get the current content from the editor if it's the active file, otherwise from fileContents
    let content: string;
    if (fileId === activeFileId && editorRef) {
      content = editorRef.getValue()
    } else {
      content = fileContents[fileId]
    }
    
    // Ensure content is not undefined
    if (content === undefined) {
      console.warn(`No content found for file ${fileId}`)
      return
    }

        // Mark the file as saved in the tabs
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === activeFileId ? { ...tab, saved: true } : tab
          )
        )
        apiClient.file.save.$post({
          json: {
            fileId: activeFileId,
            content: content,
            projectId: sandboxData.id,
          },
        })
      },
    [socket, fileContents]
  )

  // Keydown event listener to trigger file save on Ctrl+S or Cmd+S, and toggle AI chat on Ctrl+L or Cmd+L
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        saveFile(activeFileId)
      } else if (e.key === "l" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsAIChatOpen((prev) => !prev)
      }
    }

    document.addEventListener("keydown", down)

    // Added this line to prevent Monaco editor from handling Cmd/Ctrl+L
    editorRef?.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyL, () => {
      setIsAIChatOpen((prev) => !prev)
    })

    return () => {
      document.removeEventListener("keydown", down)
    }
  }, [activeFileId, saveFile, setIsAIChatOpen, editorRef])

  // Connection/disconnection effect
  useEffect(() => {
  }, [socket])

  // Socket event listener effect
  const isFirstRun = useRef(true)
  useEffect(() => {
    const onConnect = () => {}

    const onDisconnect = () => {
      setTerminals([])
    }

    const onRefreshEvent = async () => {
      try {
        const response = await apiClient.file.tree.$get({
          query: {
            projectId: sandboxData.id,
          },
        })

        if (response.status === 200) {
          const data = await response.json()
          if (data.success && data.data) {
            setFiles(data.data as (TFolder | TFile)[])
          } else {
            toast.error("Failed to load file tree")
          }
        } else {
          toast.error("Failed to load file tree")
        }
      } catch (error) {
        console.error("Error loading file tree:", error)
        toast.error("Failed to load file tree")
      }
    }

    const onError = (message: string) => {
      toast.error(message)
    }

    const onTerminalResponse = (response: { id: string; data: string }) => {
      const term = terminals.find((t) => t.id === response.id)
      if (term && term.terminal) {
        term.terminal.write(response.data)
      }
    }

    const onDisableAccess = (message: string) => {
      if (!isOwner)
        setDisableAccess({
          isDisabled: true,
          message,
        })
    }

    socket?.on("connect", onConnect)
    socket?.on("disconnect", onDisconnect)
    socket?.on("error", onError)
    socket?.on("terminalResponse", onTerminalResponse)
    socket?.on("disableAccess", onDisableAccess)
    socket?.on("previewURL", loadPreviewURL)

    // Only run onRefreshEvent on first mount
    if (isFirstRun.current) {
      onRefreshEvent()
      isFirstRun.current = false
    }

    return () => {
      socket?.off("connect", onConnect)
      socket?.off("disconnect", onDisconnect)
      socket?.off("refreshFiles", onRefreshEvent)
      socket?.off("error", onError)
      socket?.off("terminalResponse", onTerminalResponse)
      socket?.off("disableAccess", onDisableAccess)
      socket?.off("previewURL", loadPreviewURL)
    }
  }, [
    socket,
    terminals,
    setTerminals,
    setFiles,
    toast,
    setDisableAccess,
    isOwner,
    loadPreviewURL,
  ])

  // Helper functions for tabs:

  // Initialize debounced function once
  const fileCache = useRef(new Map())

  // Debounced function to get file content
  const debouncedGetFile = (tabId: any, callback: any) => {
    apiClient.file
      .$get({
        query: {
          fileId: tabId,
          projectId: sandboxData.id,
        },
      })
      .then(async (res) => {
        if (res.status === 200) {
          callback(await res.json())
        }
      })
  } // 300ms debounce delay, adjust as needed

  const selectFile = (tab: TTab) => {
    if (tab.id === activeFileId) return

    setGenerate((prev) => ({ ...prev, show: false }))
    
    // Clean up current file's diff state before switching
    if (activeFileId && editorRef) {
      cleanupBlockWidgets()
      if (mergeDecorationsCollection) {
        mergeDecorationsCollection.clear()
        setMergeDecorationsCollection(undefined)
      }
    }

    // Normalize the file path and name for comparison
    const normalizedId = tab.id.replace(/^\/+/, "") // Remove leading slashes
    const fileName = tab.name.split("/").pop() || ""

    // Check if the tab already exists in the list of open tabs
    const existingTab = tabs.find((t) => {
      const normalizedTabId = t.id.replace(/^\/+/, "")
      const tabFileName = t.name.split("/").pop() || ""
      return normalizedTabId === normalizedId || tabFileName === fileName
    })

    if (existingTab) {
      // If the tab exists, just make it active
      setActiveFileId(existingTab.id)
      setEditorLanguage(processFileType(existingTab.name))
      // Only set content if it exists in fileContents
      if (fileContents[existingTab.id] !== undefined) {
        setActiveFileContent(fileContents[existingTab.id])
      }
      
      // Restore diff state for the new file after switching
      requestAnimationFrame(() => {
        restoreDiffStateForFile(existingTab.id)
      })
    } else {
      // If the tab doesn't exist, add it to the list and make it active
      setTabs((prev) => [...prev, tab])

      // For new files, set empty content
      if (tab.id.includes("(new file)")) {
        setFileContents((prev) => ({ ...prev, [tab.id]: "" }))
        setActiveFileContent("")
        setActiveFileId(tab.id)
        setEditorLanguage(processFileType(tab.name))
      } else {
        // Fetch content if not cached
        if (!fileContents[tab.id]) {
          debouncedGetFile(tab.id, (response: string) => {
            setActiveFileId(tab.id)
            setFileContents((prev) => ({ ...prev, [tab.id]: response }))
            setActiveFileContent(response)
            setEditorLanguage(processFileType(tab.name))
            
            // Restore diff state after content is loaded
            requestAnimationFrame(() => {
              restoreDiffStateForFile(tab.id)
            })
          })
        } else {
          setActiveFileId(tab.id)
          setActiveFileContent(fileContents[tab.id])
          setEditorLanguage(processFileType(tab.name))
          
          // Restore diff state for the new file after switching
          requestAnimationFrame(() => {
            restoreDiffStateForFile(tab.id)
          })
        }
      }
    }
  }
  /**
   * The `prefetchFile` function checks if the file content for a tab is already loaded and if not,
   * fetches it using a debounced function.
   */
  const prefetchFile = (tab: TTab) => {
    if (fileContents[tab.id]) return
    debouncedGetFile(tab.id, (response: string) => {
      setFileContents((prev) => ({ ...prev, [tab.id]: response }))
    })
  }

  // Added this effect to update fileContents when the editor content changes
  useEffect(() => {
    if (activeFileId) {
      // Cache the current active file content using the file ID as the key
      setFileContents((prev) => ({
        ...prev,
        [activeFileId]: activeFileContent,
      }))
    }
  }, [activeFileContent, activeFileId])

  // Restore diff state when switching files - will be moved to selectFile function

  // Close tab and remove from tabs
  const closeTab = (id: string) => {
    const numTabs = tabs.length
    const index = tabs.findIndex((t) => t.id === id)

    console.log("closing tab", id, index)

    if (index === -1) return
    const selectedTab = tabs[index]
    // check if the tab has unsaved changes
    if (selectedTab && !selectedTab.saved) {
      // Show a confirmation dialog to the user
      setShowAlert({ type: "tab", id })
      return
    }
    const nextId =
      activeFileId === id
        ? numTabs === 1
          ? null
          : index < numTabs - 1
          ? tabs[index + 1].id
          : tabs[index - 1].id
        : activeFileId

    setTabs((prev) => prev.filter((t) => t.id !== id))
    
    // Clean up diff state for closed tab
    fileDiffStates.current.delete(id)

    if (!nextId) {
      setActiveFileId("")
    } else {
      const nextTab = tabs.find((t) => t.id === nextId)
      if (nextTab) {
        selectFile(nextTab)
      }
    }
  }

  const closeTabs = (ids: string[]) => {
    const numTabs = tabs.length

    if (numTabs === 0) return

    const allIndexes = ids.map((id) => tabs.findIndex((t) => t.id === id))

    const indexes = allIndexes.filter((index) => index !== -1)
    if (indexes.length === 0) return

    console.log("closing tabs", ids, indexes)

    const activeIndex = tabs.findIndex((t) => t.id === activeFileId)

    const newTabs = tabs.filter((t) => !ids.includes(t.id))
    setTabs(newTabs)
    
    // Clean up diff states for closed tabs
    ids.forEach(id => fileDiffStates.current.delete(id))

    if (indexes.length === numTabs) {
      setActiveFileId("")
    } else {
      const nextTab =
        newTabs.length > activeIndex
          ? newTabs[activeIndex]
          : newTabs[newTabs.length - 1]
      if (nextTab) {
        selectFile(nextTab)
      }
    }
  }

  const handleRename = (
    id: string,
    newName: string,
    oldName: string,
    type: "file" | "folder"
  ) => {
    const valid = validateName(newName, oldName, type)
    if (!valid.status) {
      if (valid.message) toast.error("Invalid file name.")
      return false
    }

    apiClient.file.rename.$post({
      json: {
        fileId: id,
        newName,
        projectId: sandboxData.id,
      },
    })
    setTabs((prev) =>
      prev.map((tab) => (tab.id === id ? { ...tab, name: newName } : tab))
    )

    return true
  }

  const handleDeleteFile = (file: TFile) => {
    apiClient.file.$delete({
      query: {
        fileId: file.id,
        projectId: sandboxData.id,
      },
    })
    closeTab(file.id)
  }

  const handleDeleteFolder = (folder: TFolder) => {
    setDeletingFolderId(folder.id)
    console.log("deleting folder", folder.id)

    apiClient.file.folder
      .$get({
        query: {
          folderId: folder.id,
          projectId: sandboxData.id,
        },
      })
      .then(async (res) => {
        if (res.status === 200) {
          const data = await res.json()
          closeTabs(data)
        }
      })

    apiClient.file.folder
      .$delete({
        query: {
          folderId: folder.id,
          projectId: sandboxData.id,
        },
      })
      .then(async (res) => {
        if (res.status === 200) {
          const data = await res.json()
          closeTabs(data.data?.map((item: any) => item.id) ?? [])
        }
      })
  }

  const togglePreviewPanel = () => {
    if (isPreviewCollapsed) {
      previewPanelRef.current?.expand()
      setIsPreviewCollapsed(false)
    } else {
      previewPanelRef.current?.collapse()
      setIsPreviewCollapsed(true)
    }
  }

  const toggleLayout = () => {
    if (!isAIChatOpen) {
      setIsHorizontalLayout((prev) => !prev)
    }
  }

  // Add an effect to handle layout changes when AI chat is opened/closed
  useEffect(() => {
    if (isAIChatOpen) {
      setPreviousLayout(isHorizontalLayout)
      setIsHorizontalLayout(true)
    } else {
      setIsHorizontalLayout(previousLayout)
    }
  }, [isAIChatOpen])

  // Modify the toggleAIChat function
  const toggleAIChat = () => {
    setIsAIChatOpen((prev) => !prev)
  }

  // Helper function to properly restore diff state for a file
  const restoreDiffStateForFile = useCallback((fileId: string) => {
    if (!editorRef) return
    
    const fileState = fileDiffStates.current.get(fileId)
    const model = editorRef.getModel()
    
    if (fileState?.granularState && model) {
      // Restore diff state for this file
      ;(model as any).granularDiffState = fileState.granularState
      
      // Restore decorations
      if (fileState.decorationsCollection) {
        setMergeDecorationsCollection(fileState.decorationsCollection)
      } else {
        // If there's granular state but no decorations, rebuild them
        rebuildEditorFromBlockState(fileState.granularState)
      }
      
      // Re-add widgets for this file's pending changes
      requestAnimationFrame(() => {
        addBlockControlWidgets(fileState.granularState!, handleBlockAction)
      })
    } else {
      // No diff state for this file - ensure everything is clean
      if (model) {
        ;(model as any).granularDiffState = undefined
        ;(model as any).originalContent = undefined
      }
      setMergeDecorationsCollection(undefined)
      cleanupBlockWidgets()
    }
  }, [editorRef, addBlockControlWidgets, handleBlockAction, rebuildEditorFromBlockState, cleanupBlockWidgets])

  // On disabled access for shared users, show un-interactable loading placeholder + info modal
  if (disableAccess.isDisabled)
    return (
      <>
        <DisableAccessModal
          message={disableAccess.message}
          open={disableAccess.isDisabled}
          setOpen={() => {}}
        />
        <Loading />
      </>
    )

  return (
    <div className="flex max-h-full overflow-hidden">
      <ChangesAlert
        state={showAlert}
        setState={setShowAlert}
        onAccept={() => {
          if (!showAlert) return
          const { id } = showAlert
          const numTabs = tabs.length

          const index = tabs.findIndex((t) => t.id === id)
          const nextId =
            activeFileId === id
              ? numTabs === 1
                ? null
                : index < numTabs - 1
                ? tabs[index + 1].id
                : tabs[index - 1].id
              : activeFileId

          setTabs((prev) => prev.filter((t) => t.id !== id))

          if (!nextId) {
            setActiveFileId("")
          } else {
            const nextTab = tabs.find((t) => t.id === nextId)
            if (nextTab) {
              selectFile(nextTab)
            }
          }
        }}
      />
      <PreviewProvider>
        {/* Copilot DOM elements */}
        <div ref={generateRef} />
        <div ref={suggestionRef} className="absolute">
          <AnimatePresence>
            {isSelected && showSuggestion && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ ease: "easeOut", duration: 0.2 }}
              >
                <Button size="xs" type="submit" onClick={() => handleAiEdit()}>
                  <Sparkles className="h-3 w-3 mr-1" />
                  Edit Code
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div
          className={cn(generate.show && "z-50 p-1")}
          ref={generateWidgetRef}
        >
          {generate.show ? (
            <GenerateInput
              user={userData}
              width={generate.width - 90}
              data={{
                fileName: tabs.find((t) => t.id === activeFileId)?.name ?? "",
                code:
                  (isSelected && editorRef?.getSelection()
                    ? editorRef
                        ?.getModel()
                        ?.getValueInRange(editorRef?.getSelection()!)
                    : editorRef?.getValue()) ?? "",
                line: generate.line,
              }}
              editor={{
                language: editorLanguage,
              }}
              onExpand={() => {
                const line = generate.line

                editorRef?.changeViewZones(function (changeAccessor) {
                  changeAccessor.removeZone(generate.id)

                  if (!generateRef.current) return
                  let id = ""
                  if (isSelected) {
                    const selection = editorRef?.getSelection()
                    if (!selection) return
                    const isAbove =
                      generate.pref?.[0] ===
                      monaco.editor.ContentWidgetPositionPreference.ABOVE
                    const afterLineNumber = isAbove ? line - 1 : line
                    id = changeAccessor.addZone({
                      afterLineNumber,
                      heightInLines: isAbove ? 11 : 12,
                      domNode: generateRef.current,
                    })
                    const contentWidget = generate.widget
                    if (contentWidget) {
                      editorRef?.layoutContentWidget(contentWidget)
                    }
                  } else {
                    id = changeAccessor.addZone({
                      afterLineNumber: cursorLine,
                      heightInLines: 12,

                      domNode: generateRef.current,
                    })
                  }
                  setGenerate((prev) => {
                    return { ...prev, id }
                  })
                })
              }}
              onAccept={(code: string) => {
                const line = generate.line
                setGenerate((prev) => {
                  return {
                    ...prev,
                    show: !prev.show,
                  }
                })
                const selection = editorRef?.getSelection()
                const range =
                  isSelected && selection
                    ? selection
                    : new monaco.Range(line, 1, line, 1)
                editorRef?.executeEdits("ai-generation", [
                  { range, text: code, forceMoveMarkers: true },
                ])
              }}
              onClose={() => {
                setGenerate((prev) => {
                  return {
                    ...prev,
                    show: !prev.show,
                  }
                })
                editorRef?.focus()
              }}
            />
          ) : null}
        </div>
        {/* Main editor components */}
        <Sidebar
          sandboxData={sandboxData}
          files={files}
          selectFile={selectFile}
          prefetchFile={prefetchFile}
          handleRename={handleRename}
          handleDeleteFile={handleDeleteFile}
          handleDeleteFolder={handleDeleteFolder}
          setFiles={setFiles}
          deletingFolderId={deletingFolderId}
          toggleAIChat={toggleAIChat}
          isAIChatOpen={isAIChatOpen}
        />
        {/* Outer ResizablePanelGroup for main layout */}
        <ResizablePanelGroup
          direction={isHorizontalLayout ? "horizontal" : "vertical"}
        >
          {/* Left side: Editor and Preview/Terminal */}
          <ResizablePanel defaultSize={isAIChatOpen ? 80 : 100} minSize={50}>
            <ResizablePanelGroup
              direction={isHorizontalLayout ? "vertical" : "horizontal"}
            >
              <ResizablePanel
                className="p-2 flex flex-col"
                maxSize={80}
                minSize={30}
                defaultSize={70}
                ref={editorPanelRef}
              >
                <div className="pb-2 w-full flex gap-2 overflow-x-auto tab-scroll">
                  {/* File tabs */}
                  {tabs.map((tab) => (
                    <Tab
                      key={tab.id}
                      saved={tab.saved}
                      selected={activeFileId === tab.id}
                      onClick={(e) => {
                        selectFile(tab)
                      }}
                      onClose={() => closeTab(tab.id)}
                    >
                      {tab.name}
                    </Tab>
                  ))}
                </div>
                {/* Monaco editor */}
                <div
                  ref={editorContainerRef}
                  className="grow w-full overflow-hidden rounded-md relative"
                >
                  {!activeFileId ? (
                    <>
                      <div className="w-full h-full flex items-center justify-center text-xl font-medium text-muted-foreground/50 select-none">
                        <FileJson className="w-6 h-6 mr-3" />
                        No file selected.
                      </div>
                    </>
                  ) : // Note clerk.loaded is required here due to a bug: https://github.com/clerk/javascript/issues/1643
                  clerk.loaded ? (
                    <>
                      {/* {provider && userInfo ? (
                          <Cursors yProvider={provider} userInfo={userInfo} />
                        ) : null} */}
                      <Editor
                        height="100%"
                        language={editorLanguage}
                        beforeMount={handleEditorWillMount}
                        onMount={handleEditorMount}
                        path={activeFileId}
                        onChange={(value) => {
                          // If the new content is different from the cached content, update it
                          if (value !== fileContents[activeFileId]) {
                            setActiveFileContent(value ?? "") // Update the active file content
                            // Mark the file as unsaved by setting 'saved' to false
                            setTabs((prev) =>
                              prev.map((tab) =>
                                tab.id === activeFileId
                                  ? { ...tab, saved: false }
                                  : tab
                              )
                            )
                          } else {
                            // If the content matches the cached content, mark the file as saved
                            setTabs((prev) =>
                              prev.map((tab) =>
                                tab.id === activeFileId
                                  ? { ...tab, saved: true }
                                  : tab
                              )
                            )
                          }
                        }}
                        theme={theme === "light" ? "vs" : "vs-dark"}
                        options={{
                          tabSize: 2,
                          minimap: {
                            enabled: false,
                          },
                          padding: {
                            bottom: 4,
                            top: 4,
                          },
                          scrollBeyondLastLine: false,
                          fixedOverflowWidgets: true,
                          fontFamily: "var(--font-geist-mono)",
                        }}
                        value={activeFileContent}
                      />
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl font-medium text-muted-foreground/50 select-none">
                      <Loader2 className="animate-spin w-6 h-6 mr-3" />
                      Waiting for Clerk to load...
                    </div>
                  )}
                </div>
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel defaultSize={30}>
                <ResizablePanelGroup
                  direction={
                    isAIChatOpen && isHorizontalLayout
                      ? "horizontal"
                      : isAIChatOpen
                      ? "vertical"
                      : isHorizontalLayout
                      ? "horizontal"
                      : "vertical"
                  }
                >
                  <ResizablePanel
                    ref={previewPanelRef}
                    defaultSize={isPreviewCollapsed ? 4 : 20}
                    minSize={25}
                    collapsedSize={isHorizontalLayout ? 20 : 4}
                    className="p-2 flex flex-col gap-2"
                    collapsible
                    onCollapse={() => setIsPreviewCollapsed(true)}
                    onExpand={() => setIsPreviewCollapsed(false)}
                  >
                    <div className="flex items-center justify-between">
                      <Button
                        onClick={toggleLayout}
                        size="sm"
                        variant="ghost"
                        className="mr-2 border"
                        disabled={isAIChatOpen}
                      >
                        {isHorizontalLayout ? (
                          <ArrowRightToLine className="w-4 h-4" />
                        ) : (
                          <ArrowDownToLine className="w-4 h-4" />
                        )}
                      </Button>
                      <PreviewWindow
                        open={togglePreviewPanel}
                        collapsed={isPreviewCollapsed}
                        src={previewURL}
                        ref={previewWindowRef}
                      />
                    </div>
                    {!isPreviewCollapsed && (
                      <div className="w-full grow rounded-md overflow-hidden bg-background mt-2">
                        <iframe
                          width={"100%"}
                          height={"100%"}
                          src={previewURL}
                        />
                      </div>
                    )}
                  </ResizablePanel>
                  <ResizableHandle />
                  <ResizablePanel
                    defaultSize={50}
                    minSize={20}
                    className="p-2 flex flex-col"
                  >
                    {isOwner ? (
                      <Terminals />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg font-medium text-muted-foreground/50 select-none">
                        <TerminalSquare className="w-4 h-4 mr-2" />
                        No terminal access.
                      </div>
                    )}
                  </ResizablePanel>
                </ResizablePanelGroup>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          {/* Right side: AIChat (if open) */}
          {isAIChatOpen && (
            <>
              <ResizableHandle />
              <ResizablePanel defaultSize={30} minSize={15}>
                <AIChat
                  activeFileContent={activeFileContent}
                  activeFileName={
                    tabs.find((tab) => tab.id === activeFileId)?.name ||
                    "No file selected"
                  }
                  onClose={toggleAIChat}
                  editorRef={{ current: editorRef }}
                  lastCopiedRangeRef={lastCopiedRangeRef}
                  files={files}
                  templateType={sandboxData.type}
                  projectName={sandboxData.name}
                  projectId={sandboxData.id}
                  handleApplyCode={handleApplyCode}
                  mergeDecorationsCollection={mergeDecorationsCollection}
                  setMergeDecorationsCollection={setMergeDecorationsCollection}
                  selectFile={selectFile}
                  tabs={tabs}
                  handleAcceptAllChanges={handleAcceptAllChanges}
                  fileDiffStates={fileDiffStates}
                  activeFileId={activeFileId}
                />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </PreviewProvider>
      <Dialog open={timeoutDialog} onOpenChange={setTimeoutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <X className="h-5 w-5 text-destructive" />
              Session Timeout
            </DialogTitle>
            <DialogDescription className="pt-2">
              Your project session has timed out. Please refresh the page to
              continue working.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button variant="default" onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
/**
 * Configure the typescript compiler to detect JSX and load type definitions
 */
const defaultCompilerOptions: monaco.languages.typescript.CompilerOptions = {
  allowJs: true,
  allowSyntheticDefaultImports: true,
  allowNonTsExtensions: true,
  resolveJsonModule: true,

  jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
  module: monaco.languages.typescript.ModuleKind.ESNext,
  moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
  target: monaco.languages.typescript.ScriptTarget.ESNext,
}
