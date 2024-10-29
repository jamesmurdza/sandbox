import { Send, StopCircle } from "lucide-react"
import { Button } from "../../ui/button"

interface ChatInputProps {
  input: string
  setInput: (input: string) => void
  isGenerating: boolean
  handleSend: () => void
  handleStopGeneration: () => void
}

export default function ChatInput({
  input,
  setInput,
  isGenerating,
  handleSend,
  handleStopGeneration,
}: ChatInputProps) {
  return (
    <div className="flex space-x-2 min-w-0">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={(e) => e.key === "Enter" && !isGenerating && handleSend()}
        className="flex-grow p-2 border rounded-lg min-w-0 bg-input"
        placeholder="Type your message..."
        disabled={isGenerating}
      />
      {isGenerating ? (
        <Button
          onClick={handleStopGeneration}
          variant="destructive"
          size="icon"
          className="h-10 w-10"
        >
          <StopCircle className="w-4 h-4" />
        </Button>
      ) : (
        <Button
          onClick={handleSend}
          disabled={isGenerating}
          size="icon"
          className="h-10 w-10"
        >
          <Send className="w-4 h-4" />
        </Button>
      )}
    </div>
  )
}
