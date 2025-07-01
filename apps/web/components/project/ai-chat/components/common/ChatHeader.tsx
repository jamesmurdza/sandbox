import { X } from "lucide-react"

interface ChatHeaderProps {
  activeFileName: string
  onClose: () => void
}

/**
 * Chat header component
 * Displays the chat title and active file name with close button
 */
export default function ChatHeader({
  activeFileName,
  onClose,
}: ChatHeaderProps) {
  return (
    <div className="flex justify-between items-center p-2 border-b text-foreground/70">
      <span className="font-medium">CHAT</span>
      <div className="flex items-center h-full">
        <span className="font-medium">{activeFileName}</span>
        <div className="mx-2 h-full w-px bg-muted-foreground/20" />
        <button
          onClick={onClose}
          className="hover:text-muted-foreground focus:outline-none"
          aria-label="Close AI Chat"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}
