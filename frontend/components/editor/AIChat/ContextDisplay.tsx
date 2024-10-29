import { ChevronDown, ChevronUp, X } from "lucide-react"

interface ContextDisplayProps {
  context: string | null
  isContextExpanded: boolean
  setIsContextExpanded: (isExpanded: boolean) => void
  setContext: (context: string | null) => void
}

export default function ContextDisplay({
  context,
  isContextExpanded,
  setIsContextExpanded,
  setContext,
}: ContextDisplayProps) {
  if (!context) return null

  return (
    <div className="mb-2 bg-input p-2 rounded-lg">
      <div className="flex justify-between items-center">
        <div
          className="flex-grow cursor-pointer"
          onClick={() => setIsContextExpanded(!isContextExpanded)}
        >
          <span className="text-sm text-gray-300">Context</span>
        </div>
        <div className="flex items-center">
          {isContextExpanded ? (
            <ChevronUp
              size={16}
              className="cursor-pointer"
              onClick={() => setIsContextExpanded(false)}
            />
          ) : (
            <ChevronDown
              size={16}
              className="cursor-pointer"
              onClick={() => setIsContextExpanded(true)}
            />
          )}
          <X
            size={16}
            className="ml-2 cursor-pointer text-gray-400 hover:text-gray-200"
            onClick={() => setContext(null)}
          />
        </div>
      </div>
      {isContextExpanded && (
        <textarea
          value={context.replace(/^Regarding this code:\n/, "")}
          onChange={(e) =>
            setContext(`Regarding this code:\n${e.target.value}`)
          }
          className="w-full mt-2 p-2 bg-#1e1e1e text-white rounded"
          rows={5}
        />
      )}
    </div>
  )
}
