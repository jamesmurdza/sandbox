import { GenerateState } from "@/components/editor/hooks/useMonacoEditor"
import { TTab } from "@/lib/types"
import * as monaco from "monaco-editor"
import { useCallback } from "react"

export interface UseGenerateWidgetProps {
  editorRef: monaco.editor.IStandaloneCodeEditor | undefined
  generate: GenerateState
  setGenerate: React.Dispatch<React.SetStateAction<GenerateState>>
  isSelected: boolean
  cursorLine: number
  generateRef: React.RefObject<HTMLDivElement>
  tabs: TTab[]
  activeFileId: string
  editorLanguage: string
}

export interface UseGenerateWidgetReturn {
  width: number
  data: {
    fileName: string
    code: string
    line: number
  }
  editor: {
    language: string
  }
  onExpand: () => void
  onAccept: (code: string) => void
  onClose: () => void
}

/**
 * Hook for handling AI Generate Widget interactions and Monaco editor integration
 */
export function useGenerateWidget({
  editorRef,
  generate,
  setGenerate,
  isSelected,
  cursorLine,
  generateRef,
  tabs,
  activeFileId,
  editorLanguage,
}: UseGenerateWidgetProps): UseGenerateWidgetReturn {
  // Handle expanding the generate widget
  const handleExpand = useCallback(() => {
    if (!editorRef) return

    const line = generate.line

    editorRef.changeViewZones(function (changeAccessor) {
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

      setGenerate((prev) => ({ ...prev, id }))
    })
  }, [
    editorRef,
    generate.line,
    generate.id,
    generate.pref,
    generate.widget,
    generateRef,
    isSelected,
    cursorLine,
    setGenerate,
  ])

  // Handle accepting generated code
  const handleAccept = useCallback(
    (code: string) => {
      if (!editorRef) return

      const line = generate.line

      // Hide the generate widget
      setGenerate((prev) => ({
        ...prev,
        show: false,
      }))

      // Determine the range to replace
      const selection = editorRef.getSelection()
      const range =
        isSelected && selection ? selection : new monaco.Range(line, 1, line, 1)

      // Execute the edit
      editorRef.executeEdits("ai-generation", [
        { range, text: code, forceMoveMarkers: true },
      ])
    },
    [editorRef, generate.line, isSelected, setGenerate]
  )

  // Handle closing the generate widget
  const handleClose = useCallback(() => {
    setGenerate((prev) => ({
      ...prev,
      show: false,
    }))
    editorRef?.focus()
  }, [editorRef, setGenerate])

  // Get the current file name
  const currentFileName = tabs.find((t) => t.id === activeFileId)?.name ?? ""

  // Get the current code (selection or entire content)
  const currentCode =
    isSelected && editorRef?.getSelection()
      ? editorRef?.getModel()?.getValueInRange(editorRef.getSelection()!) ?? ""
      : editorRef?.getValue() ?? ""

  const generateInputProps = {
    width: generate.width - 90,
    data: {
      fileName: currentFileName,
      code: currentCode,
      line: generate.line,
    },
    editor: {
      language: editorLanguage,
    },
    onExpand: handleExpand,
    onAccept: handleAccept,
    onClose: handleClose,
  }

  return generateInputProps
}
