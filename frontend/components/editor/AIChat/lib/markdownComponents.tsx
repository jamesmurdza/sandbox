import { TTab } from "@/lib/types"
import { apiClient } from "@/server/client-side-client"
import hljs from "highlight.js"
import "highlight.js/styles/github.css"
import "highlight.js/styles/vs2015.css"
import { Check, CornerUpLeft, FileText, X } from "lucide-react"
import monaco from "monaco-editor"
import React from "react"
import { Components } from "react-markdown"
import { Button } from "../../../ui/button"
import ApplyButton from "../ApplyButton"
import { isFilePath, nonFileLanguages, shellPatterns, stringifyContent } from "./chatUtils"

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
  tabs: TTab[],
  projectId: string,
  mergeDecorationsCollection?: monaco.editor.IEditorDecorationsCollection,
  setMergeDecorationsCollection?: (collection: undefined) => void,
  handleAcceptAllChanges?: () => void,
  fileDiffStates?: React.MutableRefObject<
    Map<
      string,
      {
        granularState: any
        decorationsCollection:
          | monaco.editor.IEditorDecorationsCollection
          | undefined
      }
    >
  >,
  activeFileId?: string,
  // New parameter for Apply All functionality
  codeBlocksRef?: React.MutableRefObject<
    Array<{
      code: string
      intendedFile: string
      fileName: string
      isNewFile: boolean
    }>
  >
): Components => {
  // Use a local variable to track intended file per render cycle
  let currentIntendedFile: string | null = null

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

      // Auto-detect shell commands if no language is specified
      let detectedLanguage = match ? match[1] : null

      // If no language specified, try to auto-detect common patterns
      if (!detectedLanguage) {
        const trimmedCode = stringifiedChildren.trim()

        // Multi-line check: if it contains shell-like patterns
        const lines = trimmedCode.split("\n")
        const hasShellCommands = lines.some((line) => {
          const trimmedLine = line.trim()
          return shellPatterns.some((pattern) => pattern.test(trimmedLine))
        })

        if (
          hasShellCommands ||
          shellPatterns.some((pattern) => pattern.test(trimmedCode))
        ) {
          detectedLanguage = "bash"
        }
      }

      let highlightedCode = stringifiedChildren
      if (detectedLanguage) {
        try {
          highlightedCode = hljs.highlight(stringifiedChildren, {
            language: detectedLanguage,
            ignoreIllegals: true,
          }).value
        } catch (error) {
          console.error("Error highlighting code:", error)
          // Fallback to non-highlighted code in case of error
          highlightedCode = stringifiedChildren
        }
      }

      // Determine which file this code block is for
      const targetFile = currentIntendedFile || activeFileId || activeFileName
      const targetFileName = currentIntendedFile
        ? currentIntendedFile.includes("(new file)")
          ? currentIntendedFile
              .replace(" (new file)", "")
              .split("/")
              .pop()
              ?.toLowerCase() || "unknown"
          : currentIntendedFile.split("/").pop()?.toLowerCase() || "unknown"
        : activeFileName?.split("/").pop()?.toLowerCase() || "unknown"

      // Track this code block for Apply All functionality (only for code that can be applied to files)
      if (codeBlocksRef && (match || detectedLanguage)) {
        // Check if this is a shell command using the imported shellPatterns
        const isShellCommand = shellPatterns.some((pattern) =>
          pattern.test(stringifiedChildren.trim())
        )

        // Skip shell commands and bash language blocks
        if (!isShellCommand && !nonFileLanguages.has(detectedLanguage || "")) {
          // Use currentIntendedFile if available, otherwise fall back to activeFileId/activeFileName
          const intendedFile =
            currentIntendedFile || activeFileId || activeFileName

          // Only track if we have a valid file path
          if (intendedFile && intendedFile.trim() !== "") {
            const isNewFile = currentIntendedFile
              ? currentIntendedFile.includes("(new file)")
              : false
            const blockData = {
              code: stringifiedChildren,
              intendedFile: intendedFile,
              fileName:
                targetFileName !== "unknown" ? targetFileName : "current file",
              isNewFile,
            }
            // Only track if this exact block isn't already tracked to prevent duplicates
            const isDuplicate = codeBlocksRef.current.some(
              (existing) =>
                existing.code === blockData.code &&
                existing.intendedFile === blockData.intendedFile
            )

            if (!isDuplicate) {
              codeBlocksRef.current.push(blockData)
            }
          }
        }
      }

      // Check if THIS SPECIFIC FILE has active diffs
      const fileHasActiveDiff =
        fileDiffStates?.current?.has(targetFile) &&
        fileDiffStates.current.get(targetFile)?.granularState != null

      // Only show accept/reject if:
      // 1. This code block is for the current active file
      // 2. AND that file has an active diff
      const normalizedActiveFileName =
        activeFileName?.split("/").pop()?.toLowerCase() || ""
      const showDiffControls =
        fileHasActiveDiff &&
        targetFileName === normalizedActiveFileName &&
        mergeDecorationsCollection

      // Use enhanced formatting for any detected language (including auto-detected ones)
      return match || detectedLanguage ? (
        <div className="relative border border-input rounded-md mt-8 my-2 translate-y-[-1rem]">
          <div className="absolute top-0 left-0 px-2 py-1 text-xs font-semibold text-foreground/70 rounded-tl">
            {detectedLanguage || "code"}
          </div>
          <div className="sticky top-0 right-0 flex justify-end z-10">
            <div className="flex flex-row items-center border border-input shadow-lg bg-background rounded-md">
              {renderCopyButton(stringifiedChildren)}
              {/* Only show apply/diff controls for non-shell commands */}
              {detectedLanguage !== "bash" && (
                <>
                  <div className="w-px bg-input"></div>
                  {!showDiffControls ? (
                    (() => {
                      if (
                        currentIntendedFile &&
                        targetFileName !== activeFileName.toLowerCase()
                      ) {
                        // Wrong file - show switch button
                        // Capture the intended file value to avoid race conditions
                        const intendedFilePath = currentIntendedFile
                        return (
                          <Button
                            onClick={async () => {
                              const tab: TTab = {
                                id: intendedFilePath,
                                name: targetFileName,
                                saved: true,
                                type: "file" as const,
                              }
                              selectFile(tab)
                              // Add a small delay to allow file content to load before user can apply code
                              await new Promise((resolve) =>
                                setTimeout(resolve, 100)
                              )
                            }}
                            size="sm"
                            variant="ghost"
                            className="p-1 h-6 text-xs"
                            title={`Switch to ${targetFileName} to apply this code`}
                          >
                            <FileText className="w-3 h-3 mr-1" />
                            {targetFileName}
                          </Button>
                        )
                      }

                      // Show apply button
                      return (
                        <ApplyButton
                          code={stringifiedChildren}
                          activeFileName={activeFileName}
                          activeFileContent={activeFileContent}
                          editorRef={editorRef}
                          onApply={handleApplyCode}
                        />
                      )
                    })()
                  ) : (
                    // Show diff controls only for the active file with diffs
                    <div className="flex flex-row items-center">
                      <Button
                        onClick={() => {
                          if (handleAcceptAllChanges) {
                            handleAcceptAllChanges()
                          } else {
                            // Fallback to old implementation if the new prop isn't available
                            if (
                              setMergeDecorationsCollection &&
                              mergeDecorationsCollection &&
                              editorRef?.current
                            ) {
                              const model = editorRef.current?.getModel()
                              if (model) {
                                const granularState = (model as any)
                                  .granularDiffState

                                if (granularState) {
                                  // Accept all changes in granular mode
                                  const updatedBlocks =
                                    granularState.blocks.map((block: any) => ({
                                      ...block,
                                      changes: block.changes.map(
                                        (change: any) => ({
                                          ...change,
                                          accepted: true,
                                        })
                                      ),
                                    }))

                                  const updatedState = {
                                    ...granularState,
                                    blocks: updatedBlocks,
                                    allAccepted: true,
                                  }

                                  // Apply only the accepted additions, remove all removals
                                  const finalLines: string[] = []
                                  const originalLines =
                                    granularState.originalCode.split("\n")
                                  let originalIndex = 0

                                  for (const block of updatedBlocks) {
                                    // Add unchanged lines before this block
                                    while (
                                      originalIndex <
                                      Math.min(
                                        originalLines.length,
                                        block.startLine - 1
                                      )
                                    ) {
                                      finalLines.push(
                                        originalLines[originalIndex]
                                      )
                                      originalIndex++
                                    }

                                    // Add only accepted additions (removals are skipped)
                                    const additions = block.changes.filter(
                                      (c: any) =>
                                        c.type === "added" && c.accepted
                                    )
                                    additions.forEach((change: any) => {
                                      finalLines.push(change.content)
                                    })

                                    // Skip removed lines
                                    const removals = block.changes.filter(
                                      (c: any) => c.type === "removed"
                                    )
                                    originalIndex += removals.length
                                  }

                                  // Add remaining unchanged lines
                                  while (originalIndex < originalLines.length) {
                                    finalLines.push(
                                      originalLines[originalIndex]
                                    )
                                    originalIndex++
                                  }

                                  model.setValue(finalLines.join("\n"))
                                } else {
                                  // Fallback to old behavior for backward compatibility
                                  const lines = model.getValue().split("\n")
                                  const removedLines = new Set()

                                  for (let i = 1; i <= lines.length; i++) {
                                    const lineDecorations =
                                      model.getLineDecorations(i)
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
                              }
                              mergeDecorationsCollection.clear()
                              setMergeDecorationsCollection(undefined)
                            }
                          }
                        }}
                        size="sm"
                        variant="ghost"
                        className="p-1 h-6 min-w-0 flex-shrink-0"
                        title="Accept All Changes"
                      >
                        <Check className="w-4 h-4 text-green-500" />
                      </Button>
                      <div className="w-px bg-input"></div>
                      <Button
                        onClick={() => {
                          if (
                            editorRef?.current &&
                            mergeDecorationsCollection
                          ) {
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
                        className="p-1 h-6 min-w-0 flex-shrink-0"
                        title="Discard Changes"
                      >
                        <X className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  )}
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
              className={`language-${detectedLanguage || "text"}`}
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
        const filePath = (
          isNewFile ? content.replace(" (new file)", "") : content
        )
          .split("/")
          .filter((_, index) => index !== 0)
          .join("/")

        // Set the intended file for the NEXT code blocks only
        currentIntendedFile = filePath

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
            // Find existing tab by filename only (since AI suggestions are unreliable for paths)
            const fileName = filePath.split("/").pop() || filePath
            const existingTab = tabs.find((t) => {
              const tabFileName = t.name.split("/").pop() || t.name
              return tabFileName === fileName
            })

            if (existingTab) {
              selectFile(existingTab)
            } else {
              // Create a new tab for the existing file
              const tab: TTab = {
                id: filePath,
                name: fileName,
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
      } else {
        // Reset intended file if this is not a file path
        currentIntendedFile = null
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
  }
}
