import { apiClient } from "@/server/client-side-client"
import { Check, Copy, CornerUpLeft, Loader2 } from "lucide-react"
import { useTheme } from "next-themes"
import React, { useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "../../ui/button"
import ContextTabs from "./ContextTabs"
import { copyToClipboard, stringifyContent } from "./lib/chatUtils"
import { createMarkdownComponents } from "./lib/markdownComponents"
import { MessageProps } from "./types"

// Interface for tracking code blocks in Apply All functionality
interface CodeBlockData {
  code: string
  intendedFile: string
  fileName: string
  isNewFile: boolean
}

export default function ChatMessage({
  message,
  setContext,
  setIsContextExpanded,
  socket,
  handleApplyCode,
  activeFileName,
  activeFileContent,
  editorRef,
  mergeDecorationsCollection,
  setMergeDecorationsCollection,
  selectFile,
  tabs,
  projectId,
  handleAcceptAllChanges,
  fileDiffStates,
  activeFileId,
  isStreaming,
}: MessageProps) {
  const { resolvedTheme: theme } = useTheme()
  // State for expanded message index
  const [expandedMessageIndex, setExpandedMessageIndex] = useState<
    number | null
  >(null)

  // State for copied text
  const [copiedText, setCopiedText] = useState<string | null>(null)

  // State and ref for Apply All functionality
  const [applyingAll, setApplyingAll] = useState(false)
  const [applyProgress, setApplyProgress] = useState<{
    current: number
    total: number
    currentFile?: string
  }>({ current: 0, total: 0 })
  const [applyResults, setApplyResults] = useState<{
    success: string[]
    failed: string[]
  }>({ success: [], failed: [] })
  const [modifiedFiles, setModifiedFiles] = useState<string[]>([])
  const [savingAll, setSavingAll] = useState(false)
  const [modifiedFileContents, setModifiedFileContents] = useState<
    Record<string, string>
  >({})
  const codeBlocksRef = useRef<CodeBlockData[]>([])
  const abortControllerRef = useRef<AbortController | null>(null)
  const activeFileIdRef = useRef(activeFileId)

  // Reset code blocks only when message changes (prevents race conditions)
  useEffect(() => {
    codeBlocksRef.current = []
    setApplyResults({ success: [], failed: [] })
    setModifiedFiles([])
    setModifiedFileContents({})
  }, [message.content])

  useEffect(() => {
    activeFileIdRef.current = activeFileId
  }, [activeFileId])

  // Helper function to wait for file to load properly
  const waitForFileToLoad = (
    filePath: string,
    expectedContent: string
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      let attempts = 0
      const maxAttempts = 120 // 6 seconds with 50ms intervals

      const checkFileLoaded = () => {
        attempts++

        // Normalize path
        const cleanPath = filePath.replace(" (new file)", "")
        const isRightFile = activeFileIdRef.current === cleanPath
        const editorContent = editorRef?.current?.getValue() || ""

        // Consider file loaded if we are on the right file **and** either:
        //  • expectedContent is '', OR
        //  • the editor has any content (non-empty), OR
        //  • the editor content matches expectedContent exactly (ideal case)
        const contentLoaded =
          expectedContent === ""
            ? true
            : editorContent === expectedContent || editorContent.length > 0

        if (isRightFile && contentLoaded) {
          resolve(true)
        } else if (attempts >= maxAttempts) {
          resolve(false)
        } else {
          setTimeout(checkFileLoaded, 50)
        }
      }

      checkFileLoaded()
    })
  }

  // Apply All functionality - processes all code blocks in the message
  const applyAllCodeBlocks = async (blocks: CodeBlockData[]) => {
    if (blocks.length === 0) return

    // Ensure the editor instance is ready
    let editorWaitAttempts = 0
    while (!editorRef?.current && editorWaitAttempts < 60) {
      await new Promise((resolve) => setTimeout(resolve, 50))
      editorWaitAttempts++
    }
    if (!editorRef?.current) {
      console.error("🛑 Editor instance not ready. Aborting Apply-All.")
      return
    }

    // Group blocks by file to handle multiple blocks per file
    const blocksByFile = blocks.reduce((acc, block) => {
      const cleanPath = block.intendedFile.replace(" (new file)", "")
      if (!acc[cleanPath]) {
        acc[cleanPath] = []
      }
      acc[cleanPath].push(block)
      return acc
    }, {} as Record<string, CodeBlockData[]>)

    const uniqueFiles = Object.keys(blocksByFile)

    // Show confirmation for multiple files
    if (uniqueFiles.length > 1) {
      const confirmed = window.confirm(
        `Apply changes to ${uniqueFiles.length} files?\n\nFiles: ${uniqueFiles
          .map((f) => f.split("/").pop())
          .join(", ")}`
      )
      if (!confirmed) return
    }

    setApplyingAll(true)
    setApplyResults({ success: [], failed: [] })
    setModifiedFiles([])

    // Store original file to restore later
    const originalFileId = activeFileId

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController()

    try {
      setApplyProgress({
        current: 0,
        total: uniqueFiles.length,
        currentFile: undefined,
      })
      const processedFiles: string[] = []

      // Apply each file sequentially with proper synchronization
      for (let i = 0; i < uniqueFiles.length; i++) {
        // Check for cancellation
        if (abortControllerRef.current?.signal.aborted) {
          break
        }

        const filePath = uniqueFiles[i]
        const fileBlocks = blocksByFile[filePath]
        const fileName = filePath.split("/").pop() || filePath
        const isNewFile = fileBlocks[0].intendedFile.includes("(new file)")

        // Use the latest block for this file
        const latestBlock = fileBlocks[fileBlocks.length - 1]

        setApplyProgress({
          current: i + 1,
          total: uniqueFiles.length,
          currentFile: fileName,
        })

        try {
          // Get the file content, preferring editor content if file is already open
          let fileContent = ""
          let isExistingFile = true

          // Use clean path for API calls (without "(new file)")
          const cleanPath = filePath

          // Check if file is already open and has content in editor
          const existingOpenTab = tabs.find((t) => t.id === cleanPath)
          if (
            existingOpenTab &&
            existingOpenTab.id === activeFileIdRef.current &&
            editorRef?.current
          ) {
            // Use current editor content for already-open files
            fileContent = editorRef.current?.getValue() || ""
            console.log(`Using editor content for ${fileName}`)
          } else {
            // Fetch from API for closed files or new files
            try {
              const response = await apiClient.file.$get({
                query: {
                  fileId: cleanPath,
                  projectId: projectId,
                },
              })
              if (response.status === 200) {
                fileContent = await response.json()
                console.log(`Fetched content for ${fileName} from API`)
              }
            } catch (error) {
              // File doesn't exist, will create new
              isExistingFile = false
              console.log(`File ${fileName} does not exist, will create new`)
            }
          }

          // Create/find the target tab using clean path
          let targetTab = tabs.find((t) => t.id === cleanPath)
          if (!targetTab) {
            targetTab = {
              id: cleanPath,
              name: fileName,
              saved: !isExistingFile, // New files start unsaved
              type: "file" as const,
            }
          }

          // CRITICAL: Ensure file state exists BEFORE switching files
          if (!fileDiffStates?.current?.has(cleanPath)) {
            console.log(`🔧 Pre-creating file state entry for ${fileName}`)
            fileDiffStates?.current?.set(cleanPath, {
              granularState: null,
              decorationsCollection: undefined,
            })
          }

          // Switch to the file
          selectFile(targetTab)

          // Wait for activeFileId to be updated (critical for handleApplyCode)
          let fileActivated = false
          let activationAttempts = 0
          while (!fileActivated && activationAttempts < 20) {
            if (activeFileIdRef.current === cleanPath) {
              fileActivated = true
              console.log(
                `✅ File activated: ${fileName} (activeFileId: ${activeFileIdRef.current})`
              )

              // CRITICAL: Wait for requestAnimationFrame in selectFile to complete
              // This ensures restoreDiffStateForFile has run before we continue
              await new Promise((resolve) => {
                requestAnimationFrame(() => {
                  // Add small delay to ensure restoration completes
                  setTimeout(resolve, 50)
                })
              })
            } else {
              await new Promise((resolve) => setTimeout(resolve, 50))
              activationAttempts++
            }
          }

          if (!fileActivated) {
            console.error(
              `❌ Failed to activate file: ${fileName}, activeFileId: ${activeFileIdRef.current}, expected: ${cleanPath}`
            )
            applyResults.failed.push(fileName)
            continue
          }

          // Wait for file to load properly
          const fileLoaded = await waitForFileToLoad(cleanPath, fileContent)
          if (!fileLoaded) {
            console.warn(`Failed to load file: ${fileName}`)
            applyResults.failed.push(fileName)
            continue
          }

          // Apply the code with explicit file targeting
          console.log(`🔄 Applying changes to ${fileName}...`)
          console.log(`Original content length: ${fileContent.length}`)
          console.log(`New content length: ${latestBlock.code.length}`)
          console.log(`Active file ID: ${activeFileIdRef.current}`)

          handleApplyCode(latestBlock.code, fileContent)

          // Verify that diff state was created
          await new Promise((resolve) => setTimeout(resolve, 100))

          const hasGranularState = fileDiffStates?.current?.has(cleanPath)
          console.log(`Has granular state for ${fileName}: ${hasGranularState}`)

          // Wait for diff decorations to appear (this is critical!)
          await new Promise((resolve) => setTimeout(resolve, 500))

          // Verify that decorations actually appeared
          let decorationsVisible = false
          let attempts = 0
          while (!decorationsVisible && attempts < 10) {
            const hasDecorations =
              editorRef?.current
                ?.getModel()
                ?.getAllDecorations()
                ?.some(
                  (d: any) =>
                    d.options.className?.includes("merge-conflict") ||
                    d.options.className?.includes("diff-")
                ) || false

            if (hasDecorations || mergeDecorationsCollection) {
              decorationsVisible = true
              console.log(`✅ Diff decorations visible for ${fileName}`)
            } else {
              await new Promise((resolve) => setTimeout(resolve, 100))
              attempts++
            }
          }

          if (!decorationsVisible) {
            console.warn(
              `⚠️ No diff decorations visible for ${fileName} after ${attempts} attempts`
            )
          }

          // CRITICAL: Save decoration state before moving to next file
          if (i < uniqueFiles.length - 1) {
            // Not the last file
            // CRITICAL: Save decoration recreation data (not collection reference)
            const currentFileState = fileDiffStates?.current?.get(cleanPath)
            const model = editorRef?.current?.getModel()

            if (currentFileState && model && (model as any).granularDiffState) {
              console.log(
                `💾 Saving granular state for ${fileName} before switching`
              )

              // Save the granular state - this contains everything needed to recreate decorations
              currentFileState.granularState = (model as any).granularDiffState

              // Don't save decoration collection - save the data to recreate it
              const granularState = currentFileState.granularState
              if (granularState?.blocks) {
                console.log(
                  `✅ Saved ${granularState.blocks.length} diff blocks for ${fileName}`
                )
              }
            } else {
              console.warn(
                `⚠️ Could not save state for ${fileName}: fileState=${!!currentFileState}, model=${!!model}, granularState=${!!(
                  model as any
                )?.granularDiffState}`
              )
            }

            // Give user time to see the diff decorations
            await new Promise((resolve) => setTimeout(resolve, 2000))
          } else {
            // Final file - give user time to see the last diff
            console.log(`🏁 Final file ${fileName} - preserving decorations`)
            await new Promise((resolve) => setTimeout(resolve, 1000))
          }

          // Store the modified content for this file using clean path
          const modifiedContent =
            editorRef?.current?.getValue() || latestBlock.code
          setModifiedFileContents((prev) => ({
            ...prev,
            [cleanPath]: modifiedContent,
          }))

          processedFiles.push(cleanPath)
          setApplyResults((prev) => ({
            ...prev,
            success: [...prev.success, fileName],
          }))
        } catch (error) {
          console.error(`Error applying code to ${fileName}:`, error)
          setApplyResults((prev) => ({
            ...prev,
            failed: [...prev.failed, fileName],
          }))
          // Continue with other files even if one fails
        }
      }

      // Set modified files for Save All functionality
      setModifiedFiles(processedFiles)
    } finally {
      setApplyingAll(false)
      setApplyProgress({ current: 0, total: 0, currentFile: undefined })
      abortControllerRef.current = null
    }
  }

  // Save All functionality - saves all modified files
  const saveAllModifiedFiles = async () => {
    if (modifiedFiles.length === 0) return

    setSavingAll(true)

    try {
      for (const fileId of modifiedFiles) {
        // For each file, switch to it and get its current content, or use stored content
        let fileContent = modifiedFileContents[fileId]

        // If we don't have stored content, try to get current content
        if (!fileContent) {
          // If this is the currently active file, use editor content
          if (fileId === activeFileIdRef.current) {
            fileContent = editorRef.current?.getValue() || ""
          } else {
            // For other files, fetch from API
            try {
              const response = await apiClient.file.$get({
                query: {
                  fileId: fileId,
                  projectId: projectId,
                },
              })
              if (response.status === 200) {
                fileContent = await response.json()
              }
            } catch (error) {
              console.warn(`Could not fetch content for ${fileId}`)
              continue
            }
          }
        }

        // Save the file via socket with the correct content
        await new Promise<void>((resolve, reject) => {
          socket?.emit(
            "saveFile",
            {
              fileId,
              body: fileContent,
            },
            (response: any) => {
              if (response?.success === false) {
                reject(new Error(response.error))
              } else {
                resolve()
              }
            }
          )
        })

        // Small delay between saves
        await new Promise((resolve) => setTimeout(resolve, 50))
      }

      // Clear modified files list and stored contents
      setModifiedFiles([])
      setModifiedFileContents({})
    } catch (error) {
      console.error("Error saving files:", error)
    } finally {
      setSavingAll(false)
    }
  }

  // Render copy button for text content
  const renderCopyButton = (text: any) => (
    <Button
      onClick={() => copyToClipboard(stringifyContent(text), setCopiedText)}
      size="sm"
      variant="ghost"
      className="p-1 h-6"
    >
      {copiedText === stringifyContent(text) ? (
        <Check className="w-4 h-4 text-green-500" />
      ) : (
        <Copy className="w-4 h-4" />
      )}
    </Button>
  )

  // Set context for code when asking about code
  const askAboutCode = (code: any) => {
    const contextString = stringifyContent(code)
    const newContext = `Regarding this code:\n${contextString}`

    // Format timestamp to match chat message format (HH:MM PM)
    const timestamp = new Date().toLocaleTimeString("en-US", {
      hour12: true,
      hour: "2-digit",
      minute: "2-digit",
    })

    // Instead of replacing context, append to it
    if (message.role === "assistant") {
      // For assistant messages, create a new context tab with the response content and timestamp
      setContext(newContext, `AI Response (${timestamp})`, {
        start: 1,
        end: contextString.split("\n").length,
      })
    } else {
      // For user messages, create a new context tab with the selected content and timestamp
      setContext(newContext, `User Chat (${timestamp})`, {
        start: 1,
        end: contextString.split("\n").length,
      })
    }
    setIsContextExpanded(false)
  }

  // Render markdown elements for code and text
  const renderMarkdownElement = (props: any) => {
    const { node, children } = props
    const content = stringifyContent(children)

    return (
      <div className="relative group">
        <div className="absolute top-0 right-0 flex opacity-0 group-hover:opacity-30 transition-opacity">
          {renderCopyButton(content)}
          <Button
            onClick={() => askAboutCode(content)}
            size="sm"
            variant="ghost"
            className="p-1 h-6"
          >
            <CornerUpLeft className="w-4 h-4" />
          </Button>
        </div>
        {/* Render markdown element */}
        {React.createElement(
          node.tagName,
          {
            ...props,
            className: `${
              props.className || ""
            } hover:bg-transparent rounded p-1 transition-colors`,
          },
          children
        )}
      </div>
    )
  }

  // Create markdown components
  const components = createMarkdownComponents(
    theme ?? "light",
    renderCopyButton,
    renderMarkdownElement,
    askAboutCode,
    activeFileName,
    activeFileContent,
    editorRef,
    handleApplyCode,
    selectFile,
    tabs,
    projectId,
    mergeDecorationsCollection,
    setMergeDecorationsCollection,
    handleAcceptAllChanges,
    fileDiffStates,
    activeFileId,
    codeBlocksRef
  )

  return (
    <div className="text-left relative">
      <div
        className={`relative p-2 rounded-lg ${
          message.role === "user"
            ? "bg-foreground/80 text-background"
            : "bg-background text-foreground"
        } max-w-full`}
      >
        {/* Render context tabs */}
        {message.role === "user" && message.context && (
          <div className="mb-2 rounded-lg">
            <ContextTabs
              socket={socket}
              activeFileName=""
              onAddFile={() => {}}
              contextTabs={parseContextToTabs(message.context)}
              onRemoveTab={() => {}}
              isExpanded={expandedMessageIndex === 0}
              onToggleExpand={() =>
                setExpandedMessageIndex(expandedMessageIndex === 0 ? null : 0)
              }
            />
            {expandedMessageIndex === 0 && (
              <div className="relative">
                <div className="absolute top-0 right-0 flex p-1">
                  {renderCopyButton(
                    message.context.replace(/^Regarding this code:\n/, "")
                  )}
                </div>
                {/* Render code textarea */}
                {(() => {
                  const code = message.context.replace(
                    /^Regarding this code:\n/,
                    ""
                  )
                  const match = /language-(\w+)/.exec(code)
                  const language = match ? match[1] : "typescript"
                  return (
                    <div className="pt-6">
                      <textarea
                        value={code}
                        onChange={(e) => {
                          const updatedContext = `Regarding this code:\n${e.target.value}`
                          setContext(updatedContext, "Selected Content", {
                            start: 1,
                            end: e.target.value.split("\n").length,
                          })
                        }}
                        className="w-full p-2 bg-[#1e1e1e] text-foreground font-mono text-sm rounded"
                        rows={code.split("\n").length}
                        style={{
                          resize: "vertical",
                          minHeight: "100px",
                          maxHeight: "400px",
                        }}
                      />
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        )}
        {/* Render copy and ask about code buttons */}
        {message.role === "user" && (
          <div className="absolute top-0 right-0 p-1 flex opacity-40">
            {renderCopyButton(message.content)}
            <Button
              onClick={() => askAboutCode(message.content)}
              size="sm"
              variant="ghost"
              className="p-1 h-6"
            >
              <CornerUpLeft className="w-4 h-4" />
            </Button>
          </div>
        )}
        {/* Render markdown content */}
        {message.role === "assistant" ? (
          <>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
              {message.content}
            </ReactMarkdown>
            {/* Apply All / Save All button - shows only when AI finishes and multiple files detected */}
            {(() => {
              // Only show when AI is not streaming (finished responding)
              if (isStreaming) return null

              // Calculate unique files from tracked code blocks, filtering out empty entries
              const uniqueFilePaths = new Set(
                codeBlocksRef.current
                  .map((b) => b.intendedFile.replace(" (new file)", ""))
                  .filter((f) => f && f.trim() !== "") // Filter out empty or whitespace-only paths
              )
              const uniqueFileCount = uniqueFilePaths.size

              // Debug logging (removed to prevent spam)

              // Show Apply All button only for multiple files
              const showApplyAll =
                uniqueFileCount > 1 && modifiedFiles.length === 0

              // Show Save All button when files have been modified
              const showSaveAll = modifiedFiles.length > 0

              if (!showApplyAll && !showSaveAll) return null

              return (
                // <div className="mt-4 pt-4 border-t border-border/30">
                <>
                  {showApplyAll && (
                    <>
                      {/* <Button
                        onClick={async () => {
                          await applyAllCodeBlocks(codeBlocksRef.current)
                        }}
                        disabled={applyingAll}
                        size="sm"
                        variant="default"
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        {applyingAll ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {applyProgress.total > 0
                              ? `Applying ${applyProgress.current}/${
                                  applyProgress.total
                                }${
                                  applyProgress.currentFile
                                    ? `: ${applyProgress.currentFile}`
                                    : ""
                                }...`
                              : "Applying Changes..."}
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Apply All ({uniqueFileCount}{" "}
                            {uniqueFileCount === 1 ? "file" : "files"})
                          </>
                        )}
                      </Button> */}

                      {/* File preview */}
                      {/* {!applyingAll && (
                        <p className="text-xs text-muted-foreground mt-2 text-center">
                          Will apply changes to:{" "}
                          {[...uniqueFilePaths]
                            .map((f) => {
                              const fileName = f.split("/").pop()
                              return fileName || "current file" // Fallback if filename extraction fails
                            })
                            .join(", ")}
                        </p>
                      )} */}

                      {/* Progress indicator */}
                      {applyingAll && applyProgress.total > 0 && (
                        <div className="mt-2">
                          <div className="w-full bg-secondary rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full transition-all duration-300"
                              style={{
                                width: `${
                                  (applyProgress.current /
                                    applyProgress.total) *
                                  100
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Cancel button */}
                      {applyingAll && (
                        <Button
                          onClick={() => abortControllerRef.current?.abort()}
                          size="sm"
                          variant="outline"
                          className="w-full mt-2"
                        >
                          Cancel
                        </Button>
                      )}
                    </>
                  )}

                  {showSaveAll && (
                    <Button
                      onClick={saveAllModifiedFiles}
                      disabled={savingAll}
                      size="sm"
                      variant="outline"
                      className="w-full"
                    >
                      {savingAll ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Save All ({modifiedFiles.length}{" "}
                          {modifiedFiles.length === 1 ? "file" : "files"})
                        </>
                      )}
                    </Button>
                  )}

                  {/* Results display */}
                  {(applyResults.success.length > 0 ||
                    applyResults.failed.length > 0) &&
                    !applyingAll &&
                    !showSaveAll && (
                      <div className="mt-2 text-xs">
                        {applyResults.success.length > 0 && (
                          <p className="text-green-600">
                            ✓ Applied to: {applyResults.success.join(", ")}
                          </p>
                        )}
                        {applyResults.failed.length > 0 && (
                          <p className="text-red-600">
                            ✗ Failed: {applyResults.failed.join(", ")}
                          </p>
                        )}
                      </div>
                    )}
                </>
              )
            })()}
          </>
        ) : (
          <div className="whitespace-pre-wrap group">{message.content}</div>
        )}
      </div>
    </div>
  )
}

// Parse context to tabs for context tabs component
function parseContextToTabs(context: string) {
  // Use specific regex patterns to avoid matching import statements
  const sections = context.split(/(?=File |Code from |Image \d{1,2}:)/)
  return sections
    .map((section, index) => {
      const lines = section.trim().split("\n")
      const titleLine = lines[0]
      let content = lines.slice(1).join("\n").trim()

      // Remove code block markers for display
      content = content.replace(/^```[\w-]*\n/, "").replace(/\n```$/, "")

      // Determine the type of context
      const isFile = titleLine.startsWith("File ")
      const isImage = titleLine.startsWith("Image ")
      const type = isFile ? "file" : isImage ? "image" : "code"
      const name = titleLine
        .replace(/^(File |Code from |Image )/, "")
        .replace(":", "")
        .trim()

      // Skip if the content is empty or if it's just an import statement
      if (!content || content.trim().startsWith('from "')) {
        return null
      }

      return {
        id: `context-${index}`,
        type: type as "file" | "code" | "image",
        name: name,
        content: content,
      }
    })
    .filter(
      (tab): tab is NonNullable<typeof tab> =>
        tab !== null && tab.content.length > 0
    )
}
