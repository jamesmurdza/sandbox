import * as monaco from "monaco-editor"
import { RefObject } from "react"

export interface UseCopilotElementsProps {
  generateRef: RefObject<HTMLDivElement>
  suggestionRef: RefObject<HTMLDivElement>
  generateWidgetRef: RefObject<HTMLDivElement>
  isSelected: boolean
  showSuggestion: boolean
  handleAiEdit: (editor?: monaco.editor.ICodeEditor) => void
  generate: {
    show: boolean
    [key: string]: any
  }
  userData: any
  generateInputProps: any
}

export interface UseCopilotElementsReturn {
  copilotElementsProps: {
    generateRef: RefObject<HTMLDivElement>
    suggestionWidget: {
      isSelected: boolean
      showSuggestion: boolean
      onAiEdit: () => void
      suggestionRef: RefObject<HTMLDivElement>
    }
    generateWidget: {
      show: boolean
      generateWidgetRef: RefObject<HTMLDivElement>
      userData: any
      generateInputProps: any
    }
  }
}

/**
 * Hook for managing Copilot DOM elements and their props
 */
export function useCopilotElements({
  generateRef,
  suggestionRef,
  generateWidgetRef,
  isSelected,
  showSuggestion,
  handleAiEdit,
  generate,
  userData,
  generateInputProps,
}: UseCopilotElementsProps): UseCopilotElementsReturn {
  const copilotElementsProps = {
    generateRef,
    suggestionWidget: {
      isSelected,
      showSuggestion,
      onAiEdit: () => handleAiEdit(),
      suggestionRef,
    },
    generateWidget: {
      show: generate.show,
      generateWidgetRef,
      userData,
      generateInputProps,
    },
  }

  return {
    copilotElementsProps,
  }
}
