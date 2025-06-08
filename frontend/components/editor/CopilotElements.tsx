"use client"

import { User } from "@/lib/types"
import { cn } from "@/lib/utils"
import AISuggestionWidget from "./AISuggestionWidget"
import GenerateInput from "./generate"

export interface CopilotElementsProps {
  generateRef: React.RefObject<HTMLDivElement>
  suggestionWidget: {
    isSelected: boolean
    showSuggestion: boolean
    onAiEdit: () => void
    suggestionRef: React.RefObject<HTMLDivElement>
  }
  generateWidget: {
    show: boolean
    generateWidgetRef: React.RefObject<HTMLDivElement>
    userData: User
    generateInputProps: any
  }
}

/**
 * Container for all AI Copilot elements (suggestion widget, generate widget, etc.)
 */
export default function CopilotElements({
  generateRef,
  suggestionWidget,
  generateWidget,
}: CopilotElementsProps) {
  return (
    <>
      {/* Generate DOM anchor point */}
      <div ref={generateRef} />

      {/* AI Suggestion Widget */}
      <AISuggestionWidget
        isSelected={suggestionWidget.isSelected}
        showSuggestion={suggestionWidget.showSuggestion}
        onAiEdit={suggestionWidget.onAiEdit}
        suggestionRef={suggestionWidget.suggestionRef}
      />

      {/* Generate Widget */}
      <div
        className={cn(generateWidget.show && "z-50 p-1")}
        ref={generateWidget.generateWidgetRef}
      >
        {generateWidget.show ? (
          <GenerateInput
            user={generateWidget.userData}
            {...generateWidget.generateInputProps}
          />
        ) : null}
      </div>
    </>
  )
}
