"use client"

import { streamChat } from "@/app/actions/ai"
import { cn } from "@/lib/utils"
import { useRouter } from "@bprogress/next/app"
import { Editor } from "@monaco-editor/react"
import { readStreamableValue } from "ai/rsc"
import { Check, Loader2, RotateCw, Sparkles, X } from "lucide-react"
import { useTheme } from "next-themes"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "../../ui/button"

interface GenerateInputProps {
  width: number
  data: {
    fileName: string
    code: string
    line: number
  }
  editor: {
    language: string
  }
  onExpand: () => void
  onAccept: (code: string) => void
  onClose: () => void
}
interface GenerateWidgetProps extends GenerateInputProps {
  generateRef: React.RefObject<HTMLDivElement>
  generateWidgetRef: React.RefObject<HTMLDivElement>
  show: boolean
}
export function GenerateWidget({
  generateRef,
  generateWidgetRef,
  show,
  ...inputProps
}: GenerateWidgetProps) {
  return (
    <>
      {/* Generate DOM anchor point */}
      <div ref={generateRef} />
      {/* Generate Widget */}
      <div className={cn(show && "z-50 p-1")} ref={generateWidgetRef}>
        {show ? <GenerateInput {...inputProps} /> : null}
      </div>
    </>
  )
}

function GenerateInput({
  width,
  data,
  editor,
  onExpand,
  onAccept,
  onClose,
}: GenerateInputProps) {
  const { resolvedTheme: theme } = useTheme()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [code, setCode] = useState("")
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState({
    generate: false,
    regenerate: false,
  })
  const [input, setInput] = useState("")
  const [currentPrompt, setCurrentPrompt] = useState("")

  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
  }, [inputRef.current])

  const handleGenerate = async ({
    regenerate = false,
  }: {
    regenerate?: boolean
  }) => {
    try {
      setLoading({ generate: !regenerate, regenerate })
      setCurrentPrompt(input)

      const selectedCode = data.code
      const instruction = regenerate ? currentPrompt : input

      const { output } = await streamChat(
        [{ role: "user", content: instruction }],
        {
          templateType: "code",
          activeFileContent: selectedCode,
          projectName: data.fileName,
          isEditMode: true,
        }
      )

      let result = ""

      for await (const chunk of readStreamableValue(output)) {
        result += chunk
      }

      // Clean up any potential markdown or explanation text
      const cleanedResult = result
        .replace(/```[\w-]*\n?/g, "") // Remove code fence markers
        .replace(/^[\s\n]*/, "") // Remove leading whitespace/newlines
        .replace(/[\s\n]*$/, "") // Remove trailing whitespace/newlines
        .trim()

      setCode(cleanedResult)
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate code"
      )
    } finally {
      setLoading({ generate: false, regenerate: false })
    }
  }
  const handleGenerateForm = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      handleGenerate({ regenerate: false })
    },
    [input, currentPrompt]
  )

  useEffect(() => {
    if (code) {
      setExpanded(true)
      onExpand()
      setLoading({ generate: false, regenerate: false })
    }
  }, [code])

  useEffect(() => {
    //listen to when Esc key is pressed and close the modal
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <div className="w-full pr-4 space-y-2">
      <form
        onSubmit={handleGenerateForm}
        className="flex items-center font-sans space-x-2"
      >
        <input
          ref={inputRef}
          style={{
            width: width + "px",
          }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Generate code with a prompt"
          className="h-8 w-full rounded-md border border-muted-foreground bg-transparent px-3 py-1 text-sm shadow-sm transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />

        <Button
          size="sm"
          type="submit"
          disabled={loading.generate || loading.regenerate || input === ""}
        >
          {loading.generate ? (
            <>
              <Loader2 className="animate-spin h-3 w-3 mr-2" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-3 w-3 mr-2" />
              Generate Code
            </>
          )}
        </Button>
        <Button
          onClick={onClose}
          type="button"
          variant="outline"
          size="smIcon"
          className="bg-transparent shrink-0 border-muted-foreground"
        >
          <X className="h-3 w-3" />
        </Button>
      </form>
      {expanded ? (
        <>
          <div className="rounded-md border border-muted-foreground w-full h-28 overflow-y-scroll p-2 bg-muted">
            <Editor
              height="100%"
              defaultLanguage={editor.language}
              value={code}
              theme={theme === "light" ? "vs" : "vs-dark"}
              options={{
                minimap: {
                  enabled: false,
                },
                scrollBeyondLastLine: false,
                fontFamily: "var(--font-geist-mono)",
                domReadOnly: true,
                readOnly: true,
                lineNumbers: "off",
                glyphMargin: false,
                folding: false,
                // Undocumented see https://github.com/Microsoft/vscode/issues/30795#issuecomment-410998882
                lineDecorationsWidth: 0,
                lineNumbersMinChars: 0,
              }}
            />
          </div>
          <div className="flex space-x-2 font-sans">
            <Button
              disabled={loading.generate || loading.regenerate}
              onClick={() => onAccept(code)}
              size="sm"
            >
              <Check className="h-3 w-3 mr-2" />
              Accept
            </Button>
            <Button
              onClick={() => handleGenerate({ regenerate: true })}
              disabled={loading.generate || loading.regenerate}
              variant="outline"
              size="sm"
              className="bg-muted border-muted-foreground"
            >
              {loading.regenerate ? (
                <>
                  <Loader2 className="animate-spin h-3 w-3 mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <RotateCw className="h-3 w-3 mr-2" />
                  Re-Generate
                </>
              )}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  )
}
