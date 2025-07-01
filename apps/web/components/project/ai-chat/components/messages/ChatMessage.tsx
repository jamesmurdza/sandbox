import { MessageProps } from "../../lib/types"
import { formatTimestamp, stringifyContent } from "../../lib/utils"
import AssistantMessage from "./AssistantMessage"
import UserMessage from "./UserMessage"

/**
 * Chat message component
 * Routes to appropriate message type component
 */
export default function ChatMessage({
  message,
  setContext,
  setIsContextExpanded,
  handleApplyCode,
  activeFileName,
  activeFileContent,
  editorRef,
  mergeDecorationsCollection,
  setMergeDecorationsCollection,
  selectFile,
  tabs,
  projectId,
}: MessageProps) {
  /**
   * Handle asking about code
   */
  const askAboutCode = (code: any) => {
    const contextString = stringifyContent(code)
    const newContext = `Regarding this code:\n${contextString}`
    const timestamp = formatTimestamp()

    // Create context tab based on message role
    const tabName =
      message.role === "assistant"
        ? `AI Response (${timestamp})`
        : `User Chat (${timestamp})`

    setContext(newContext, tabName, {
      start: 1,
      end: contextString.split("\n").length,
    })
    setIsContextExpanded(false)
  }

  /**
   * Handle context changes from user message
   */
  const handleContextChange = (
    context: string,
    name: string,
    range?: { start: number; end: number }
  ) => {
    setContext(context, name, range)
  }

  return (
    <div className="text-left relative">
      {message.role === "user" ? (
        <UserMessage
          message={message}
          onAskAbout={askAboutCode}
          onContextChange={handleContextChange}
        />
      ) : (
        <AssistantMessage
          message={message}
          activeFileName={activeFileName}
          activeFileContent={activeFileContent}
          editorRef={editorRef}
          handleApplyCode={handleApplyCode}
          selectFile={selectFile}
          tabs={tabs}
          projectId={projectId}
          mergeDecorationsCollection={mergeDecorationsCollection}
          setMergeDecorationsCollection={setMergeDecorationsCollection}
          askAboutCode={askAboutCode}
        />
      )}
    </div>
  )
}
