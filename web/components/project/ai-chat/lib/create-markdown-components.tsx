import { TTab } from "@/lib/types"
import { apiClient } from "@/server/client"
import hljs from "highlight.js"
import "highlight.js/styles/github.css"
import "highlight.js/styles/vs2015.css"
import { Check, CornerUpLeft, FileText, X } from "lucide-react"
import monaco from "monaco-editor"
import { Components } from "react-markdown"
import { Button } from "../../../ui/button"
import ApplyButton from "../components/common/ApplyButton"
import { isFilePath, stringifyContent } from "./utils"

// Create markdown components for chat message component
export const createMarkdownComponents = (
  theme: string,
  renderCopyButton: (text: any) => JSX.Element,
  askAboutCode: (code: any) => void,
  activeFileName: string,
  activeFileContent: string,
  editorRef: any,
  handleApplyCode: (mergedCode: string, originalCode: string) => void,
  selectFile: (tab: TTab) => void,
  tabs: TTab[],
  projectId: string,
  mergeDecorationsCollection?: monaco.editor.IEditorDecorationsCollection,
  setMergeDecorationsCollection?: (collection: undefined) => void,
  templateType?: string,
  projectName?: string
): Components => {
  // State to track the intended file for the next code block
  let intendedFile: string | null = null

  return {
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
      const stringifiedChildren = stringifyContent(children)

      // Capture the intended file for this specific code block
      const codeBlockIntendedFile = intendedFile

      let highlightedCode = stringifiedChildren
      if (match && match[1]) {
        try {
          highlightedCode = hljs.highlight(stringifiedChildren, {
            language: match[1],
            ignoreIllegals: true,
          }).value
        } catch (error) {
          console.error("Error highlighting code:", error)
          // Fallback to non-highlighted code in case of error
          highlightedCode = stringifiedChildren
        }
      }

      return match ? (
        <div className="relative border border-input rounded-md mt-8 my-2 translate-y-[-1rem]">
          <div className="absolute top-0 left-0 px-2 py-1 text-xs font-semibold text-foreground/70 rounded-tl">
            {match[1]}
          </div>
          <div className="sticky top-0 right-0 flex justify-end z-10">
            <div className="flex border border-input shadow-lg bg-background rounded-md">
              {renderCopyButton(stringifiedChildren)}
              <div className="w-px bg-input"></div>
              {!mergeDecorationsCollection ? (
                (() => {
                  if (codeBlockIntendedFile) {
                    const intendedFileName = codeBlockIntendedFile.split("/").pop() || ""
                    const currentFileName = activeFileName

                    if (intendedFileName.toLowerCase() === currentFileName.toLowerCase()) {
                      // Correct file - show normal apply
                      return (
                        <ApplyButton
                          code={stringifiedChildren}
                          activeFileName={activeFileName}
                          activeFileContent={activeFileContent}
                          editorRef={editorRef}
                          onApply={handleApplyCode}
                          templateType={templateType}
                          projectName={projectName}
                        />
                      )
                    } else {
                      // Wrong file - show switch button
                      return (
                        <Button
                          onClick={() => {
                            const tab: TTab = {
                              id: codeBlockIntendedFile!,
                              name: codeBlockIntendedFile!.split("/").pop() || "",
                              saved: true,
                              type: "file",
                            }
                            selectFile(tab)
                            // Apply will be available after file switch
                          }}
                          size="sm"
                          variant="ghost"
                          className="p-1 h-6 text-xs"
                          title={`Switch to ${intendedFileName} to apply this code`}
                        >
                          <FileText className="w-3 h-3 mr-1" />
                          {intendedFileName}
                        </Button>
                      )
                    }
                  }

                  // No intended file - show normal apply
                  return (
                    <ApplyButton
                      code={stringifiedChildren}
                      activeFileName={activeFileName}
                      activeFileContent={activeFileContent}
                      editorRef={editorRef}
                      onApply={handleApplyCode}
                      templateType={templateType}
                      projectName={projectName}
                    />
                  )
                })()
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
                  askAboutCode(stringifiedChildren)
                }}
                size="sm"
                variant="ghost"
                className="p-1 h-6"
              >
                <CornerUpLeft className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <pre
            className={`hljs ${theme === "light" ? "hljs-light" : "hljs-dark"}`}
            style={{
              margin: 0,
              padding: "0.5rem",
              fontSize: "0.875rem",
              background: "transparent",
            }}
          >
            <code
              className={`language-${match[1]}`}
              dangerouslySetInnerHTML={{ __html: highlightedCode }}
            />
          </pre>
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

      if (isFilePath(content)) {
        const isNewFile = content.endsWith("(new file)")
        const cleanContent = isNewFile ? content.replace(" (new file)", "") : content

        // Use the clean content directly as the file path - no project name stripping needed
        const filePath = cleanContent.trim()

        // Set the intended file for the next code blocks
        intendedFile = filePath

        const handleFileClick = () => {
          if (isNewFile) {
            apiClient.file.create
              .$post({
                json: {
                  name: filePath,
                  projectId: projectId,
                },
              })
              .then((res) => {
                if (res.status === 200) {
                  const tab: TTab = {
                    id: filePath,
                    name: filePath.split("/").pop() || "",
                    saved: true,
                    type: "file",
                  }
                  selectFile(tab)
                }
              })
          } else {
            // First check if the file exists in the current tabs
            const existingTab = tabs.find(
              (t) => t.id === filePath || t.name === filePath.split("/").pop()
            )
            if (existingTab) {
              selectFile(existingTab)
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

      return <p className="mb-4 leading-7">{children}</p>
    },
    h1: ({ node, children, ...props }) => (
      <h1 className="text-3xl font-bold mb-4 mt-6" {...props}>
        {children}
      </h1>
    ),
    h2: ({ node, children, ...props }) => (
      <h2 className="text-2xl font-semibold mb-3 mt-5" {...props}>
        {children}
      </h2>
    ),
    h3: ({ node, children, ...props }) => (
      <h3 className="text-xl font-semibold mb-2 mt-4" {...props}>
        {children}
      </h3>
    ),
    h4: ({ node, children, ...props }) => (
      <h4 className="text-lg font-semibold mb-2 mt-4" {...props}>
        {children}
      </h4>
    ),
    h5: ({ node, children, ...props }) => (
      <h5 className="text-base font-semibold mb-2 mt-3" {...props}>
        {children}
      </h5>
    ),
    h6: ({ node, children, ...props }) => (
      <h6 className="text-sm font-semibold mb-2 mt-3" {...props}>
        {children}
      </h6>
    ),
    ul: (props) => (
      <ul className="list-disc pl-6 mb-4 space-y-2">{props.children}</ul>
    ),
    ol: (props) => (
      <ol className="list-decimal pl-6 mb-4 space-y-2">{props.children}</ol>
    ),
  }
}
