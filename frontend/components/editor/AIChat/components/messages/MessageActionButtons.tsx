import { Check, Copy, CornerUpLeft } from "lucide-react"
import { Button } from "../../../../ui/button"
import { stringifyContent } from "../../lib/utils"

interface MessageActionButtonsProps {
  content: any
  onCopy: (text: string) => void
  onAskAbout: (content: any) => void
  copiedText: string | null
}

/**
 * Action buttons for messages
 * Provides copy and ask-about functionality
 */
export default function MessageActionButtons({
  content,
  onCopy,
  onAskAbout,
  copiedText,
}: MessageActionButtonsProps) {
  const text = stringifyContent(content)

  return (
    <div className="flex">
      <Button
        onClick={() => onCopy(text)}
        size="sm"
        variant="ghost"
        className="p-1 h-6"
      >
        {copiedText === text ? (
          <Check className="w-4 h-4 text-green-500" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </Button>
      <Button
        onClick={() => onAskAbout(content)}
        size="sm"
        variant="ghost"
        className="p-1 h-6"
      >
        <CornerUpLeft className="w-4 h-4" />
      </Button>
    </div>
  )
}
