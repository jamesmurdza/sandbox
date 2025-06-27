"use client"
import { GenerateState } from "@/components/editor/hooks/useMonacoEditor"
import { TTab } from "@/lib/types"
import * as monaco from "monaco-editor"
import AISuggestionWidget from "./AISuggestionWidget"
import { GenerateWidget } from "./generate"
import { useGenerateWidget } from "./hooks/useGenerateWidget"

export interface CopilotElementsProps {
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
export default function CopilotElements({
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
CopilotElementsProps) {
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
      <AISuggestionWidget
        isSelected={isSelected}
        showSuggestion={showSuggestion}
        onAiEdit={handleAiEdit}
        suggestionRef={suggestionRef}
      />
    </>
  )
}
