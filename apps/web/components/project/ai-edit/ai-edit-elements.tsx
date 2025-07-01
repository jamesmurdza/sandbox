"use client"
import { GenerateState } from "@/components/project/hooks/useMonacoEditor"
import { TTab } from "@/lib/types"
import * as monaco from "monaco-editor"
import { useGenerateWidget } from "../hooks/useGenerateWidget"
import EditCodeWidget from "./edit-code-widget"
import { GenerateWidget } from "./generate-widget"

export interface AIEditElementsProps {
  generateRef: React.RefObject<HTMLDivElement>
  suggestionRef: React.RefObject<HTMLDivElement>
  generateWidgetRef: React.RefObject<HTMLDivElement>
  editorRef: monaco.editor.IStandaloneCodeEditor | undefined
  generate: GenerateState
  setGenerate: React.Dispatch<React.SetStateAction<GenerateState>>
  isSelected: boolean
  cursorLine: number
  tabs: TTab[]
  activeFileId: string
  editorLanguage: string
  handleAiEdit: (editor?: monaco.editor.ICodeEditor) => void
  showSuggestion: boolean
}

/**
 * Container for all AI Copilot elements (suggestion widget, generate widget, etc.)
 */
export default function AIEditElements({
  generateRef,
  generateWidgetRef,
  suggestionRef,
  editorRef,
  generate,
  setGenerate,
  isSelected,
  cursorLine,
  tabs,
  activeFileId,
  editorLanguage,
  showSuggestion,
  handleAiEdit,
}: // suggestionWidget,
// generateWidget,
AIEditElementsProps) {
  const generateInputProps = useGenerateWidget({
    editorRef,
    generate,
    setGenerate,
    isSelected,
    cursorLine,
    generateRef,
    tabs,
    activeFileId,
    editorLanguage,
  })
  return (
    <>
      {/* Generate Widget */}
      <GenerateWidget
        generateRef={generateRef}
        generateWidgetRef={generateWidgetRef}
        show={generate.show}
        {...generateInputProps}
      />
      {/* AI Suggestion Widget */}
      <EditCodeWidget
        isSelected={isSelected}
        showSuggestion={showSuggestion}
        onAiEdit={handleAiEdit}
        suggestionRef={suggestionRef}
      />
    </>
  )
}
