import { useSocket } from "@/context/SocketContext"
import { fileRouter } from "@/lib/api"
import {
  configureEditorKeybindings,
  defaultCompilerOptions,
} from "@/lib/monaco/config"
import { parseTSConfigToMonacoOptions } from "@/lib/tsconfig"
import { TFile, TFolder } from "@/lib/types"
import { debounce, deepMerge } from "@/lib/utils"
import { BeforeMount, OnMount } from "@monaco-editor/react"
import * as monaco from "monaco-editor"
import { useCallback, useEffect, useRef, useState } from "react"
import { ImperativePanelHandle } from "react-resizable-panels"

export interface UseMonacoEditorProps {
  editorPanelRef: React.RefObject<ImperativePanelHandle>
  setIsAIChatOpen: (fn: (prev: boolean) => boolean) => void
}

export interface GenerateState {
  show: boolean
  id: string
  line: number
  widget: monaco.editor.IContentWidget | undefined
  pref: monaco.editor.ContentWidgetPositionPreference[]
  width: number
}

export interface DecorationsState {
  options: monaco.editor.IModelDeltaDecoration[]
  instance: monaco.editor.IEditorDecorationsCollection | undefined
}

export interface UseMonacoEditorReturn {
  // Editor state
  editorRef: monaco.editor.IStandaloneCodeEditor | undefined
  monacoRef: React.MutableRefObject<typeof monaco | null>
  cursorLine: number
  isSelected: boolean
  showSuggestion: boolean

  // Generate/AI state
  generate: GenerateState
  setGenerate: React.Dispatch<React.SetStateAction<GenerateState>>
  decorations: DecorationsState
  setDecorations: React.Dispatch<React.SetStateAction<DecorationsState>>

  // Refs
  generateRef: React.RefObject<HTMLDivElement>
  suggestionRef: React.RefObject<HTMLDivElement>
  generateWidgetRef: React.RefObject<HTMLDivElement>
  lastCopiedRangeRef: React.MutableRefObject<{
    startLine: number
    endLine: number
  } | null>

  // Handlers
  handleEditorWillMount: BeforeMount
  handleEditorMount: OnMount
  handleAiEdit: (editor?: monaco.editor.ICodeEditor) => void

  // Internal setters
  setEditorRef: (editor: monaco.editor.IStandaloneCodeEditor) => void
  setCursorLine: (line: number) => void
  setIsSelected: (selected: boolean) => void
  setShowSuggestion: (show: boolean) => void
}

export const useMonacoEditor = ({
  editorPanelRef,
  setIsAIChatOpen,
}: UseMonacoEditorProps): UseMonacoEditorReturn => {
  const { data: files = [] } = fileRouter.fileTree.useQuery({
    select(data) {
      return data.data
    },
  })
  // Editor state
  const [editorRef, setEditorRef] =
    useState<monaco.editor.IStandaloneCodeEditor>()
  const [cursorLine, setCursorLine] = useState(0)
  const [isSelected, setIsSelected] = useState(false)
  const [showSuggestion, setShowSuggestion] = useState(false)
  const { socket } = useSocket()
  // AI Copilot state
  const [generate, setGenerate] = useState<GenerateState>({
    show: false,
    line: 0,
    id: "",
    widget: undefined,
    pref: [],
    width: 0,
  })

  const [decorations, setDecorations] = useState<DecorationsState>({
    options: [],
    instance: undefined,
  })

  // Refs
  const monacoRef = useRef<typeof monaco | null>(null)
  const generateRef = useRef<HTMLDivElement>(null)
  const suggestionRef = useRef<HTMLDivElement>(null)
  const generateWidgetRef = useRef<HTMLDivElement>(null)
  const lastCopiedRangeRef = useRef<{
    startLine: number
    endLine: number
  } | null>(null)

  // Debounced selection handler
  const debouncedSetIsSelected = useRef(
    debounce((value: boolean) => {
      setIsSelected(value)
    }, 800)
  ).current

  // Helper function to fetch file content
  const fetchFileContent = useCallback(
    (fileId: string): Promise<string> => {
      return new Promise((resolve) => {
        socket?.emit("getFile", { fileId }, (content: string) => {
          resolve(content)
        })
      })
    },
    [socket]
  )

  // Load and merge TSConfig
  const loadTSConfig = useCallback(
    async (
      files: (TFolder | TFile)[],
      editor: monaco.editor.IStandaloneCodeEditor,
      monaco: typeof import("monaco-editor")
    ) => {
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
    },
    [fetchFileContent]
  )

  // Pre-mount editor keybindings
  const handleEditorWillMount: BeforeMount = useCallback((monaco) => {
    configureEditorKeybindings(monaco)
  }, [])

  // AI edit handler
  const handleAiEdit = useCallback(
    (editor?: monaco.editor.ICodeEditor) => {
      console.log("editorRef", editorRef)
      const e = editor ?? editorRef
      if (!e || typeof e.getSelection !== "function") return

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
    [editorRef, generateRef, setGenerate]
  )

  // Post-mount editor keybindings and actions
  const handleEditorMount: OnMount = useCallback(
    async (editor, monaco) => {
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

      // Load TSConfig
      await loadTSConfig(files, editor, monaco)

      // Set up editor event handlers
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
        run: (editor) => handleAiEdit(editor),
      })

      // Add Cmd/Ctrl+L command for AI chat toggle
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyL, () => {
        setIsAIChatOpen((prev) => !prev)
      })
    },
    [
      files,
      loadTSConfig,
      cursorLine,
      handleAiEdit,
      setIsAIChatOpen,
      debouncedSetIsSelected,
    ]
  )

  // Generate widget effect
  useEffect(() => {
    if (generate.show) {
      setShowSuggestion(false)

      // Only create view zone if it doesn't already exist
      if (!generate.id) {
        editorRef?.changeViewZones(function (changeAccessor) {
          if (!generateRef.current) return
          const id = changeAccessor.addZone({
            afterLineNumber: cursorLine,
            heightInLines: 3,
            domNode: generateRef.current,
          })
          setGenerate((prev) => {
            return { ...prev, id, line: cursorLine }
          })
        })
      }

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
              lineNumber: generate.line || cursorLine,
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
  }, [
    generate.show,
    generate.id,
    generate.line,
    generate.pref,
    cursorLine,
    editorPanelRef,
    editorRef,
  ])

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
  }, [isSelected, editorRef])

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
  }, [decorations.options, cursorLine, editorRef])

  // useEffect(() => {}, [tabs])
  return {
    // Editor state
    editorRef,
    monacoRef,
    cursorLine,
    isSelected,
    showSuggestion,

    // Generate/AI state
    generate,
    setGenerate,
    decorations,
    setDecorations,

    // Refs
    generateRef,
    suggestionRef,
    generateWidgetRef,
    lastCopiedRangeRef,

    // Handlers
    handleEditorWillMount,
    handleEditorMount,
    handleAiEdit,

    // Internal setters
    setEditorRef,
    setCursorLine,
    setIsSelected,
    setShowSuggestion,
  }
}
