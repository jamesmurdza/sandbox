"use client"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
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
    debounce,
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
    const interval = setInterval(
      () =>
        socket?.emit("heartbeat", {}, (success: boolean) => {
          if (!success) {
            setTimeoutDialog(true)
          }
        }),
      10000
    )
    return () => clearInterval(interval)
  }, [socket])

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

  // File state
  const [files, setFiles] = useState<(TFolder | TFile)[]>([])
  const [tabs, setTabs] = useState<TTab[]>([])
  const [activeFileId, setActiveFileId] = useState<string>("")
  const [activeFileContent, setActiveFileContent] = useState("")
  const [deletingFolderId, setDeletingFolderId] = useState("")
  // Added this state to track the most recent content for each file
  const [fileContents, setFileContents] = useState<Record<string, string>>({})

  // Apply Button merger decoration state
  const [mergeDecorations, setMergeDecorations] = useState<
    monaco.editor.IModelDeltaDecoration[]
  >([])
  const [mergeDecorationsCollection, setMergeDecorationsCollection] =
    useState<monaco.editor.IEditorDecorationsCollection>()

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

  console.log("has Unsaved: ", hasUnsavedFiles, tabs)
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

  const debouncedSetIsSelected = useRef(
    debounce((value: boolean) => {
      setIsSelected(value)
    }, 800) //
  ).current
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
        socket?.emit("getFile", { fileId }, (content: string) => {
          resolve(content)
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
        debouncedSetIsSelected(hasSelection)
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

  // Enhanced handle apply code with granular diff tracking  
  const handleApplyCode = useCallback(
    (mergedCode: string, originalCode: string) => {
      if (!editorRef) return
      const model = editorRef.getModel()
      if (!model) return
      ;(model as any).originalContent = originalCode

      // Use the imported diffLines function for proper diff detection
      const changes = diffLines(originalCode, mergedCode, { ignoreWhitespace: false })
      
      const decorations: monaco.editor.IModelDeltaDecoration[] = []
      const combinedLines: string[] = []
      const diffBlocks: DiffBlock[] = []
      const allChanges: LineChange[] = []

      let currentLine = 1
      let currentBlockId = ""
      let currentBlock: LineChange[] = []

      const generateId = () => `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      for (let i = 0; i < changes.length; i++) {
        const change = changes[i]
        const lines = change.value.split('\n').filter((line: string, idx: number, arr: string[]) => {
          // Keep all lines except the last empty line (which is just the trailing newline)
          return idx < arr.length - 1 || line !== ''
        })

        if (change.added || change.removed) {
          // Start new block if needed
          if (currentBlock.length === 0) {
            currentBlockId = generateId()
          }

          // Process each line in this change
          lines.forEach((line: string, lineIdx: number) => {
              combinedLines.push(line)
            const lineNumber = combinedLines.length
            const changeId = generateId()
            
            const lineChange: LineChange = {
              id: changeId,
              lineNumber,
              type: change.added ? 'added' : 'removed',
              content: line,
              blockId: currentBlockId,
              accepted: false, // Initially pending - user must accept/reject
              originalLineNumber: currentLine + lineIdx
            }
            
            allChanges.push(lineChange)
            currentBlock.push(lineChange)

            // Add decoration
              decorations.push({
              range: new monaco.Range(lineNumber, 1, lineNumber, 1),
                options: {
                  isWholeLine: true,
                className: change.added ? "added-line-decoration" : "removed-line-decoration",
                glyphMarginClassName: change.added ? "added-line-glyph" : "removed-line-glyph", 
                linesDecorationsClassName: change.added ? "added-line-number" : "removed-line-number",
                minimap: { 
                  color: change.added ? "rgb(0, 255, 0, 0.2)" : "rgb(255, 0, 0, 0.2)", 
                  position: 2 
                },
                },
              })
            })

          // Don't increment currentLine for removals since they don't exist in new content
          if (!change.removed) {
            currentLine += lines.length
          }
        } else {
          // Unchanged content - finalize any pending block
          if (currentBlock.length > 0) {
            const diffBlock: DiffBlock = {
              id: currentBlockId,
              startLine: currentBlock[0].lineNumber,
              endLine: currentBlock[currentBlock.length - 1].lineNumber,
              changes: currentBlock,
              type: currentBlock.some((c: LineChange) => c.type === 'added') && currentBlock.some((c: LineChange) => c.type === 'removed') 
                ? 'modification' 
                : currentBlock[0].type === 'added' ? 'addition' : 'deletion'
            }
            diffBlocks.push(diffBlock)
            currentBlock = []
          }

          // Add unchanged lines
          lines.forEach((line: string) => {
              combinedLines.push(line)
            currentLine++
          })
        }
      }

      // Handle any remaining block
      if (currentBlock.length > 0) {
        const diffBlock: DiffBlock = {
          id: currentBlockId,
          startLine: currentBlock[0].lineNumber,
          endLine: currentBlock[currentBlock.length - 1].lineNumber,
          changes: currentBlock,
          type: currentBlock.some((c: LineChange) => c.type === 'added') && currentBlock.some((c: LineChange) => c.type === 'removed') 
            ? 'modification' 
            : currentBlock[0].type === 'added' ? 'addition' : 'deletion'
        }
        diffBlocks.push(diffBlock)
      }

      // Store granular diff state
      const granularDiffState: GranularDiffState = {
        blocks: diffBlocks,
        originalCode,
        mergedCode,
        allAccepted: false // Initially false since changes start as pending
      }
      ;(model as any).granularDiffState = granularDiffState

      model.setValue(combinedLines.join("\n"))
      const newDecorations = editorRef.createDecorationsCollection(decorations)
      setMergeDecorationsCollection(newDecorations)

      // Add floating block control widgets next to each diff chunk
      addBlockControlWidgets(granularDiffState, handleBlockAction)
    },
    [editorRef]
  )

  // Handle block accept/reject actions
  const handleBlockAction = useCallback(
    (blockId: string, action: 'accept' | 'reject') => {
      if (!editorRef) return
      const model = editorRef.getModel()
      if (!model) return

      const granularState = (model as any).granularDiffState as GranularDiffState
      if (!granularState) return

      // Update all changes in the specific block
      const updatedBlocks = granularState.blocks.map(block => 
        block.id === blockId 
          ? {
              ...block,
              changes: block.changes.map(change => ({
                ...change, 
                accepted: action === 'accept'
              }))
            }
          : block
      )

      const updatedState: GranularDiffState = {
        ...granularState,
        blocks: updatedBlocks,
        allAccepted: updatedBlocks.every(block => 
          block.changes.every(change => change.accepted)
        )
      }

      ;(model as any).granularDiffState = updatedState

      // Rebuild the editor content based on accepted changes
      rebuildEditorFromBlockState(updatedState)
      
      // Remove the widget for the processed block
      const existingWidgets = (editorRef as any).blockControlWidgets || []
      const updatedWidgets = existingWidgets.filter((widget: any) => {
        if (widget.getId() === `block-controls-${blockId}`) {
          editorRef.removeContentWidget(widget)
          return false
        }
        return true
      })
      ;(editorRef as any).blockControlWidgets = updatedWidgets

      // Update editor state after accepting/rejecting changes
      if (activeFileId) {
        const currentContent = model.getValue()
        
        // Update file contents state
        setFileContents((prev) => ({
          ...prev,
          [activeFileId]: currentContent,
        }))
        
        // Update active file content
        setActiveFileContent(currentContent)
        
        // Mark the file as unsaved since content has changed
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === activeFileId ? { ...tab, saved: false } : tab
          )
        )
      }
    },
    [editorRef, activeFileId, setFileContents, setActiveFileContent, setTabs]
  )

  // Add floating block control widgets positioned next to diff chunks
  const addBlockControlWidgets = useCallback(
    (granularState: GranularDiffState, blockActionHandler: (blockId: string, action: 'accept' | 'reject') => void) => {
      if (!editorRef) return

      // Remove any existing block widgets first
      const existingWidgets = (editorRef as any).blockControlWidgets || []
      existingWidgets.forEach((widget: any) => {
        editorRef.removeContentWidget(widget)
      })

      const widgets: any[] = []

      granularState.blocks.forEach((block, index) => {
        console.log(`Block ${index + 1}: lines ${block.startLine}-${block.endLine}, type: ${block.type}`)
        
        // Always show controls - they will be refreshed when user takes action
        
        // Create widget DOM element with same UI components
        const widgetElement = document.createElement('div')
        widgetElement.className = 'block-controls-widget'
        widgetElement.innerHTML = `
          <div style="display: flex; border: 1px solid hsl(var(--border)); background: hsl(var(--background)); border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 2px;">
            <button class="accept-block-btn" data-block-id="${block.id}" 
                    style="display: flex; align-items: center; padding: 4px 6px; border: none; background: transparent; cursor: pointer; border-radius: 4px; font-size: 11px; color: hsl(var(--foreground));" 
                    title="Accept Block ${index + 1}">
              <svg style="width: 12px; height: 12px; color: #22c55e;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
              <span style="margin-left: 4px;">${index + 1}</span>
            </button>
            <div style="width: 1px; background: hsl(var(--border)); margin: 2px 0;"></div>
            <button class="reject-block-btn" data-block-id="${block.id}" 
                    style="display: flex; align-items: center; padding: 4px 6px; border: none; background: transparent; cursor: pointer; border-radius: 4px; font-size: 11px; color: hsl(var(--foreground));" 
                    title="Reject Block ${index + 1}">
              <svg style="width: 12px; height: 12px; color: #ef4444;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
              <span style="margin-left: 4px;">${index + 1}</span>
            </button>
          </div>
        `

        // Add event listeners
        const acceptBtn = widgetElement.querySelector('.accept-block-btn')
        const rejectBtn = widgetElement.querySelector('.reject-block-btn')
        
        acceptBtn?.addEventListener('click', () => blockActionHandler(block.id, 'accept'))
        rejectBtn?.addEventListener('click', () => blockActionHandler(block.id, 'reject'))

        // Add hover effects
        acceptBtn?.addEventListener('mouseenter', (e) => {
          (e.target as HTMLElement).style.backgroundColor = 'rgba(34, 197, 94, 0.1)'
        })
        acceptBtn?.addEventListener('mouseleave', (e) => {
          (e.target as HTMLElement).style.backgroundColor = 'transparent'
        })
        
        rejectBtn?.addEventListener('mouseenter', (e) => {
          (e.target as HTMLElement).style.backgroundColor = 'rgba(239, 68, 68, 0.1)'
        })
        rejectBtn?.addEventListener('mouseleave', (e) => {
          (e.target as HTMLElement).style.backgroundColor = 'transparent'
        })

        // Create content widget positioned next to the diff block
        const widget = {
          getDomNode: () => widgetElement,
          getId: () => `block-controls-${block.id}`,
          getPosition: () => {
            const model = editorRef.getModel()
            if (!model) return null
            
            // Get the line content to position after it
            const lineContent = model.getLineContent(block.startLine)
            const lineLength = lineContent.length
            
            return {
              position: {
                lineNumber: block.startLine, // Position at the start of the block instead of end
                column: Math.max(lineLength + 1, 1) // Position right after the line content
              },
              preference: [monaco.editor.ContentWidgetPositionPreference.ABOVE] // Position above the line
            }
          }
        }

        editorRef.addContentWidget(widget)
        widgets.push(widget)
      })

      // Store widgets for cleanup
      ;(editorRef as any).blockControlWidgets = widgets
    },
    [editorRef]
  )

  // Rebuild editor content based on block diff state  
  const rebuildEditorFromBlockState = useCallback(
    (granularState: GranularDiffState) => {
      if (!editorRef) return
      const model = editorRef.getModel()
      if (!model) return

      const originalLines = granularState.originalCode.split("\n")
      const result: string[] = []
      const newDecorations: monaco.editor.IModelDeltaDecoration[] = []

      let originalIndex = 0
      let resultLineNumber = 0

      for (const block of granularState.blocks) {
        // Add unchanged lines before this block
        while (originalIndex < Math.min(originalLines.length, block.startLine - 1)) {
          result.push(originalLines[originalIndex])
          originalIndex++
          resultLineNumber++
        }

        // Process changes in this block
        const acceptedRemovals = block.changes.filter(c => c.type === 'removed' && c.accepted)
        const acceptedAdditions = block.changes.filter(c => c.type === 'added' && c.accepted)
        const rejectedRemovals = block.changes.filter(c => c.type === 'removed' && !c.accepted)
        const rejectedAdditions = block.changes.filter(c => c.type === 'added' && !c.accepted)

        // Add rejected removals (keep original lines with decoration)
        rejectedRemovals.forEach(change => {
          result.push(change.content)
          resultLineNumber++
          
          // Always add decoration for rejected removals (they're still pending deletion)
          newDecorations.push({
            range: new monaco.Range(resultLineNumber, 1, resultLineNumber, 1),
            options: {
              isWholeLine: true,
              className: "removed-line-decoration",
              glyphMarginClassName: "removed-line-glyph",
              linesDecorationsClassName: "removed-line-number",
              minimap: { color: "rgb(255, 0, 0, 0.2)", position: 2 },
            },
          })
        })

        // Add accepted additions  
        acceptedAdditions.forEach(change => {
          result.push(change.content)
          resultLineNumber++
        })
        
        // Add rejected additions (show as pending additions with decoration)
        rejectedAdditions.forEach(change => {
          result.push(change.content)
          resultLineNumber++
          
          // Always add decoration for rejected additions (they're still pending)
          newDecorations.push({
            range: new monaco.Range(resultLineNumber, 1, resultLineNumber, 1),
            options: {
              isWholeLine: true,
              className: "added-line-decoration",
              glyphMarginClassName: "added-line-glyph",
              linesDecorationsClassName: "added-line-number",
              minimap: { color: "rgb(0, 255, 0, 0.2)", position: 2 },
            },
          })
        })

        // Skip original lines that were accepted for removal
        originalIndex += acceptedRemovals.length
      }

      // Add remaining unchanged lines
      while (originalIndex < originalLines.length) {
        result.push(originalLines[originalIndex])
        originalIndex++
        resultLineNumber++
      }

      // Update editor content and decorations
      model.setValue(result.join("\n"))
      
      // Clear existing decorations and only add new ones for unprocessed blocks
      if (mergeDecorationsCollection) {
        mergeDecorationsCollection.clear()
      }
      
      if (newDecorations.length > 0) {
        const decorationsCollection = editorRef.createDecorationsCollection(newDecorations)
        setMergeDecorationsCollection(decorationsCollection)
      } else {
        // If no decorations remain, clear the collection completely
        setMergeDecorationsCollection(undefined)
      }
    },
    [editorRef, mergeDecorationsCollection, setMergeDecorationsCollection]
  )

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

  // Save file keybinding logic effect
  // Function to save the file content after a debounce period
  const debouncedSaveData = useCallback(
    debounce((activeFileId: string | undefined) => {
      if (activeFileId) {
        // Get the current content of the file
        const content = fileContents[activeFileId]

        // Mark the file as saved in the tabs
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === activeFileId ? { ...tab, saved: true } : tab
          )
        )
        socket?.emit("saveFile", { fileId: activeFileId, body: content })
      }
    }, Number(process.env.FILE_SAVE_DEBOUNCE_DELAY) || 1000),
    [socket, fileContents]
  )

  // Keydown event listener to trigger file save on Ctrl+S or Cmd+S, and toggle AI chat on Ctrl+L or Cmd+L
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        debouncedSaveData(activeFileId)
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
  }, [activeFileId, tabs, debouncedSaveData, setIsAIChatOpen, editorRef])

  // // Liveblocks live collaboration setup effect
  // useEffect(() => {
  //   const tab = tabs.find((t) => t.id === activeFileId)
  //   const model = editorRef?.getModel()

  //   if (!editorRef || !tab || !model) return

  //   let providerData: ProviderData

  //   // When a file is opened for the first time, create a new provider and store in providersMap.
  //   if (!providersMap.current.has(tab.id)) {
  //     const yDoc = new Y.Doc()
  //     const yText = yDoc.getText(tab.id)
  //     const yProvider = new LiveblocksProvider(room, yDoc)

  //     // Inserts the file content into the editor once when the tab is changed.
  //     const onSync = (isSynced: boolean) => {
  //       if (isSynced) {
  //         const text = yText.toString()
  //         if (text === "") {
  //           if (activeFileContent) {
  //             yText.insert(0, activeFileContent)
  //           } else {
  //             setTimeout(() => {
  //               yText.insert(0, editorRef.getValue())
  //             }, 0)
  //           }
  //         }
  //       }
  //     }

  //     yProvider.on("sync", onSync)

  //     // Save the provider to the map.
  //     providerData = { provider: yProvider, yDoc, yText, onSync }
  //     providersMap.current.set(tab.id, providerData)
  //   } else {
  //     // When a tab is opened that has been open before, reuse the existing provider.
  //     providerData = providersMap.current.get(tab.id)!
  //   }

  //   const binding = new MonacoBinding(
  //     providerData.yText,
  //     model,
  //     new Set([editorRef]),
  //     providerData.provider.awareness as unknown as Awareness
  //   )

  //   providerData.binding = binding
  //   setProvider(providerData.provider)

  //   return () => {
  //     // Cleanup logic
  //     if (binding) {
  //       binding.destroy()
  //     }
  //     if (providerData.binding) {
  //       providerData.binding = undefined
  //     }
  //   }
  // }, [room, activeFileContent])

  // // Added this effect to clean up when the component unmounts
  // useEffect(() => {
  //   return () => {
  //     // Clean up all providers when the component unmounts
  //     providersMap.current.forEach((data) => {
  //       if (data.binding) {
  //         data.binding.destroy()
  //       }
  //       data.provider.disconnect()
  //       data.yDoc.destroy()
  //     })
  //     providersMap.current.clear()
  //   }
  // }, [])

  // Connection/disconnection effect
  useEffect(() => {
  }, [socket])

  // Socket event listener effect
  useEffect(() => {
    const onConnect = () => {}

    const onDisconnect = () => {
      setTerminals([])
    }

    const onLoadedEvent = (files: (TFolder | TFile)[]) => {
      setFiles(files)
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
    socket?.on("loaded", onLoadedEvent)
    socket?.on("error", onError)
    socket?.on("terminalResponse", onTerminalResponse)
    socket?.on("disableAccess", onDisableAccess)
    socket?.on("previewURL", loadPreviewURL)

    return () => {
      socket?.off("connect", onConnect)
      socket?.off("disconnect", onDisconnect)
      socket?.off("loaded", onLoadedEvent)
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
    socket?.emit("getFile", { fileId: tabId }, callback)
  } // 300ms debounce delay, adjust as needed

  const selectFile = (tab: TTab) => {
    if (tab.id === activeFileId) return

    setGenerate((prev) => ({ ...prev, show: false }))

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
          })
        } else {
          setActiveFileId(tab.id)
          setActiveFileContent(fileContents[tab.id])
          setEditorLanguage(processFileType(tab.name))
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

    socket?.emit("renameFile", { fileId: id, newName })
    setTabs((prev) =>
      prev.map((tab) => (tab.id === id ? { ...tab, name: newName } : tab))
    )

    return true
  }

  const handleDeleteFile = (file: TFile) => {
    socket?.emit("deleteFile", { fileId: file.id })
    closeTab(file.id)
  }

  const handleDeleteFolder = (folder: TFolder) => {
    setDeletingFolderId(folder.id)
    console.log("deleting folder", folder.id)

    socket?.emit("getFolder", { folderId: folder.id }, (response: string[]) =>
      closeTabs(response)
    )

    socket?.emit(
      "deleteFolder",
      { folderId: folder.id },
      (response: (TFolder | TFile)[]) => {
        setDeletingFolderId("")
      }
    )
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
                  handleApplyCode={handleApplyCode}
                  mergeDecorationsCollection={mergeDecorationsCollection}
                  setMergeDecorationsCollection={setMergeDecorationsCollection}
                  selectFile={selectFile}
                  tabs={tabs}
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
