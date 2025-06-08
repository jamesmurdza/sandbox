"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Sparkles } from "lucide-react"
import { Button } from "../ui/button"

export interface AISuggestionWidgetProps {
  isSelected: boolean
  showSuggestion: boolean
  onAiEdit: () => void
  suggestionRef: React.RefObject<HTMLDivElement>
}

/**
 * AI Suggestion Widget that appears when text is selected
 * Shows an animated "Edit Code" button with AI capabilities
 */
export default function AISuggestionWidget({
  isSelected,
  showSuggestion,
  onAiEdit,
  suggestionRef,
}: AISuggestionWidgetProps) {
  return (
    <div ref={suggestionRef} className="absolute">
      <AnimatePresence>
        {isSelected && showSuggestion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ ease: "easeOut", duration: 0.2 }}
          >
            <Button size="xs" type="submit" onClick={onAiEdit}>
              <Sparkles className="h-3 w-3 mr-1" />
              Edit Code
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
