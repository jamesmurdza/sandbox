import { Check, Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "../../ui/button"

interface ApplyButtonProps {
  code: string
  activeFileName: string
  activeFileContent: string
  editorRef: { current: any }
  onApply: (mergedCode: string, originalCode: string) => void
}

export default function ApplyButton({
  code,
  activeFileName,
  activeFileContent,
  editorRef,
  onApply,
}: ApplyButtonProps) {
  const [isApplying, setIsApplying] = useState(false)

  const handleApply = async () => {
    // Note: File validation is now handled at the UI level in markdownComponents.tsx
    // This button will only be enabled for appropriate files
    
    setIsApplying(true)
    try {
      const response = await fetch("/api/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalCode: activeFileContent,
          newCode: String(code),
          fileName: activeFileName,
        }),
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      const mergedCode = await response.text()
      onApply(mergedCode.trim(), activeFileContent)
    } catch (error) {
      console.error("Error applying code:", error)
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
