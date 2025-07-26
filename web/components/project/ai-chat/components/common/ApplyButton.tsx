import { Check, Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { merge } from "../../../../../app/actions/ai"

interface ApplyButtonProps {
  code: string
  activeFileName: string
  activeFileContent: string
  editorRef: { current: any }
  onApply: (mergedCode: string, originalCode: string) => void
  templateType?: string
  projectName?: string
}

export default function ApplyButton({
  code,
  activeFileName,
  activeFileContent,
  onApply,
  templateType,
  projectName,
}: ApplyButtonProps) {
  const [isApplying, setIsApplying] = useState(false)

  const handleApply = async () => {
    setIsApplying(true)
    try {
      const response = await merge(
        activeFileContent,
        String(code),
        activeFileName,
        {
          templateType,
          projectName,
        }
      )

      if (response && typeof response === "string") {
        onApply(response, activeFileContent)
      } else {
        throw new Error("Invalid response from merge function")
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to apply code changes"
      )
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <Button
      onClick={handleApply}
      size="sm"
      variant="ghost"
      className="p-1 h-6"
      disabled={isApplying}
    >
      {isApplying ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Check className="w-4 h-4" />
      )}
    </Button>
  )
}
