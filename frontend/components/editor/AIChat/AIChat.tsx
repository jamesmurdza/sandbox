import { useSocket } from "@/context/SocketContext"
import { TFile } from "@/lib/types"
import { apiClient } from "@/server/client"
import { useRef } from "react"
import ChatContainer from "./components/common/ChatContainer"
import ChatHeader from "./components/common/ChatHeader"
import ContextTabs from "./components/common/ContextTabs"
import ChatInput from "./components/input/ChatInput"
import { useChat } from "./hooks/useChat"
import { useContextTabs } from "./hooks/useContextTabs"
import { AIChatProps } from "./lib/types"

/**
 * Main AI Chat component
 * Provides an interface for chatting with AI about code
 */
export default function AIChat({
  activeFileContent,
  activeFileName,
  onClose,
  editorRef,
  lastCopiedRangeRef,
  files,
  templateType,
  handleApplyCode,
  selectFile,
  mergeDecorationsCollection,
  setMergeDecorationsCollection,
  projectName,
  tabs,
  projectId,
}: AIChatProps) {
  const { socket } = useSocket()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Use custom hooks for chat functionality
  const {
    messages,
    setMessages,
    input,
    setInput,
    isGenerating,
    isLoading,
    contextTabs: chatContextTabs,
    addContextTab,
    removeContextTab,
    getCombinedContext,
    sendMessage,
    stopGeneration,
  } = useChat(activeFileContent, templateType, files, projectName)

  // Use custom hook for context tabs management
  const {
    contextTabs,
    setContextTabs,
    isContextExpanded,
    setIsContextExpanded,
    setContext,
  } = useContextTabs(activeFileName, activeFileContent)

  // Merge context tabs from both hooks
  const allContextTabs = [...contextTabs, ...chatContextTabs]

  /**
   * Handle sending message with context
   */
  const handleSend = async () => {
    const combinedContext = getCombinedContext()
    await sendMessage(input, combinedContext)
    setIsContextExpanded(false)
  }

  /**
   * Handle file selection from context tabs
   */
  const handleFileSelect = async (file: TFile) => {
    try {
      const res = await apiClient.file.$get({
        query: {
          fileId: file.id,
          projectId: projectId,
        },
      })
      const fileData = await res.json()
      const fileExt = file.name.split(".").pop() || "txt"
      const formattedContent = `\`\`\`${fileExt}\n${fileData}\n\`\`\``
      addContextTab("file", file.name, formattedContent)
      textareaRef.current?.focus()
    } catch (error) {
      console.error("Error loading file:", error)
    }
  }

  return (
    <div className="flex flex-col h-screen w-full">
      <ChatHeader activeFileName={activeFileName} onClose={onClose} />

      <ChatContainer
        messages={messages}
        isLoading={isLoading}
        messageProps={{
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
        }}
      />

      <div className="p-4 border-t mb-14">
        <ContextTabs
          activeFileName={activeFileName}
          onAddFile={(file) => handleFileSelect(file as TFile)}
          contextTabs={allContextTabs}
          onRemoveTab={(id) => {
            removeContextTab(id)
            setContextTabs((prev) => prev.filter((tab) => tab.id !== id))
          }}
          isExpanded={isContextExpanded}
          onToggleExpand={() => setIsContextExpanded(!isContextExpanded)}
          files={files}
          socket={socket}
        />

        <ChatInput
          textareaRef={textareaRef}
          addContextTab={addContextTab}
          editorRef={editorRef}
          input={input}
          setInput={setInput}
          isGenerating={isGenerating}
          handleSend={handleSend}
          handleStopGeneration={stopGeneration}
          onImageUpload={(file) => {
            const reader = new FileReader()
            reader.onload = (e) => {
              if (e.target?.result) {
                addContextTab("image", file.name, e.target.result as string)
              }
            }
            reader.readAsDataURL(file)
          }}
          lastCopiedRangeRef={lastCopiedRangeRef}
          activeFileName={activeFileName}
          contextTabs={allContextTabs.map((tab) => ({
            ...tab,
            title: tab.id,
          }))}
          onRemoveTab={(id) => {
            removeContextTab(id)
            setContextTabs((prev) => prev.filter((tab) => tab.id !== id))
          }}
        />
      </div>
    </div>
  )
}
