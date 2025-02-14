import { useSocket } from "@/context/SocketContext"
import { TTab } from "@/lib/types"
import { Check, CornerUpLeft, FileText, X } from "lucide-react"
import monaco from "monaco-editor"
import { Components } from "react-markdown"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import {
  vscDarkPlus,
  vscLightPlus,
} from "react-syntax-highlighter/dist/esm/styles/prism"
import { Button } from "../../../ui/button"
import ApplyButton from "../ApplyButton"
import { isFilePath, stringifyContent } from "./chatUtils"

// Create markdown components for chat message component
export const createMarkdownComponents = (
  theme: string,
  renderCopyButton: (text: any) => JSX.Element,
  renderMarkdownElement: (props: any) => JSX.Element,
  askAboutCode: (code: any) => void,
  activeFileName: string,
  activeFileContent: string,
  editorRef: any,
  handleApplyCode: (mergedCode: string, originalCode: string) => void,
  selectFile: (tab: TTab) => void,
  mergeDecorationsCollection?: monaco.editor.IEditorDecorationsCollection,
  setMergeDecorationsCollection?: (collection: undefined) => void
): Components => ({
  code: ({
    node,
    className,
    children,
    ...props
  }: {
    node?: import("hast").Element
    className?: string
    children?: React.ReactNode
    [key: string]: any
  }) => {
    const match = /language-(\w+)/.exec(className || "")

    return match ? (
      <div className="relative border border-input rounded-md mt-8 my-2 translate-y-[-1rem]">
        <div className="absolute top-0 left-0 px-2 py-1 text-xs font-semibold text-foreground/70 rounded-tl">
          {match[1]}
        </div>
        <div className="sticky top-0 right-0 flex justify-end z-10">
          <div className="flex border border-input shadow-lg bg-background rounded-md">
            {renderCopyButton(children)}
            <div className="w-px bg-input"></div>
            {!mergeDecorationsCollection ? (
              <ApplyButton
                code={String(children)}
                activeFileName={activeFileName}
                activeFileContent={activeFileContent}
                editorRef={editorRef}
                onApply={handleApplyCode}
              />
            ) : (
              <>
                <Button
                  onClick={() => {
                    if (
                      setMergeDecorationsCollection &&
                      mergeDecorationsCollection &&
                      editorRef?.current
                    ) {
                      const model = editorRef.current.getModel()
                      if (model) {
                        const lines = model.getValue().split("\n")
                        const removedLines = new Set()

                        // Get decorations line by line
                        for (let i = 1; i <= lines.length; i++) {
                          const lineDecorations = model.getLineDecorations(i)
                          if (
                            lineDecorations?.some(
                              (d: any) =>
                                d.options.className ===
                                "removed-line-decoration"
                            )
                          ) {
                            removedLines.add(i)
                          }
                        }

                        const finalLines = lines.filter(
                          (_: string, index: number) =>
                            !removedLines.has(index + 1)
                        )
                        model.setValue(finalLines.join("\n"))
                      }
                      mergeDecorationsCollection.clear()
                      setMergeDecorationsCollection(undefined)
                    }
                  }}
                  size="sm"
                  variant="ghost"
                  className="p-1 h-6"
                  title="Accept Changes"
                >
                  <Check className="w-4 h-4 text-green-500" />
                </Button>
                <div className="w-px bg-input"></div>
                <Button
                  onClick={() => {
                    if (editorRef?.current && mergeDecorationsCollection) {
                      const model = editorRef.current.getModel()
                      if (model && (model as any).originalContent) {
                        editorRef.current?.setValue(
                          (model as any).originalContent
                        )
                        mergeDecorationsCollection.clear()
                        setMergeDecorationsCollection?.(undefined)
                      }
                    }
                  }}
                  size="sm"
                  variant="ghost"
                  className="p-1 h-6"
                  title="Discard Changes"
                >
                  <X className="w-4 h-4 text-red-500" />
                </Button>
              </>
            )}
            <div className="w-px bg-input"></div>
            <Button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                askAboutCode(children)
              }}
              size="sm"
              variant="ghost"
              className="p-1 h-6"
            >
              <CornerUpLeft className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <SyntaxHighlighter
          style={theme === "light" ? vscLightPlus : vscDarkPlus}
          language={match[1]}
          PreTag="div"
          customStyle={{
            margin: 0,
            padding: "0.5rem",
            fontSize: "0.875rem",
          }}
        >
          {stringifyContent(children)}
        </SyntaxHighlighter>
      </div>
    ) : (
      <code className={className} {...props}>
        {children}
      </code>
    )
  },
  // Render markdown elements
  p: ({ node, children, ...props }) => {
    const content = stringifyContent(children)
    const { socket } = useSocket()

    if (isFilePath(content)) {
      const isNewFile = content.endsWith("(new file)")
      const filePath = (
        isNewFile ? content.replace(" (new file)", "") : content
      )
        .split("/")
        .filter((part, index) => index !== 0)
        .join("/")

      const handleFileClick = () => {
        if (isNewFile) {
          socket?.emit(
            "createFile",
            {
              name: filePath,
            },
            (response: any) => {
              if (response.success) {
                const tab: TTab = {
                  id: filePath,
                  name: filePath.split("/").pop() || "",
                  saved: true,
                  type: "file",
                }
                selectFile(tab)
              }
            }
          )
        } else {
          const tab: TTab = {
            id: filePath,
            name: filePath.split("/").pop() || "",
            saved: true,
            type: "file",
          }
          selectFile(tab)
        }
      }

      return (
        <div
          onClick={handleFileClick}
          className="group flex items-center gap-2 px-2 py-1 bg-secondary/50 rounded-md my-2 text-xs hover:bg-secondary cursor-pointer w-fit"
        >
          <FileText className="h-4 w-4" />
          <span className="font-mono group-hover:underline">{content}</span>
        </div>
      )
    }

    return renderMarkdownElement({ node, children, ...props })
  },
  h1: ({ node, children, ...props }) =>
    renderMarkdownElement({ node, children, ...props }),
  h2: ({ node, children, ...props }) =>
    renderMarkdownElement({ node, children, ...props }),
  h3: ({ node, children, ...props }) =>
    renderMarkdownElement({ node, children, ...props }),
  h4: ({ node, children, ...props }) =>
    renderMarkdownElement({ node, children, ...props }),
  h5: ({ node, children, ...props }) =>
    renderMarkdownElement({ node, children, ...props }),
  h6: ({ node, children, ...props }) =>
    renderMarkdownElement({ node, children, ...props }),
  ul: (props) => (
    <ul className="list-disc pl-6 mb-4 space-y-2">{props.children}</ul>
  ),
  ol: (props) => (
    <ol className="list-decimal pl-6 mb-4 space-y-2">{props.children}</ol>
  ),
})
