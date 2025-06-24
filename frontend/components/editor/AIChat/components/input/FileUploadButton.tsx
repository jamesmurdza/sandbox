import { ReactNode } from "react"
import { Button } from "../../../../ui/button"

interface FileUploadButtonProps {
  accept: string
  onFileSelect: (file: File) => void
  icon: ReactNode
  label?: string
  className?: string
}

/**
 * Reusable file upload button
 * Handles file selection with specified accept types
 */
export default function FileUploadButton({
  accept,
  onFileSelect,
  icon,
  label,
  className = "h-6 px-2 sm:px-3",
}: FileUploadButtonProps) {
  const handleClick = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = accept
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) onFileSelect(file)
    }
    input.click()
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={className}
      onClick={handleClick}
    >
      {icon}
      {label && <span className="hidden sm:inline">{label}</span>}
    </Button>
  )
}
