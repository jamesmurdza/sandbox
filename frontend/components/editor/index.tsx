"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PreviewProvider } from "@/context/PreviewContext"
import { useChangesAlert } from "@/hooks/useChangesAlert"
import { useCodeDiffer } from "@/hooks/useCodeDiffer"
import { useCopilotElements } from "@/hooks/useCopilotElements"
import { useEditorLayout } from "@/hooks/useEditorLayout"
import { useEditorShortcuts } from "@/hooks/useEditorShortcuts"
import { useEditorSocket } from "@/hooks/useEditorSocket"
import { useFileManager } from "@/hooks/useFileManager"
import { useGenerateWidget } from "@/hooks/useGenerateWidget"
import { useMonacoEditor } from "@/hooks/useMonacoEditor"
import { useSocketHandlers } from "@/hooks/useSocketHandlers"
import { Sandbox, TFile, TFolder, User } from "@/lib/types"
import { X } from "lucide-react"
import * as monaco from "monaco-editor"
import { useCallback, useState } from "react"
import { Button } from "../ui/button"
import ChangesAlert, { AlertState } from "./changes-alert"
import CopilotElements from "./CopilotElements"
import EditorLayout from "./EditorLayout"
import DisableAccessModal from "./live/disableModal"
import Loading from "./loading"
import Sidebar from "./sidebar"

export default function CodeEditor({
  userData,
  sandboxData,
}: {
  userData: User
  sandboxData: Sandbox
}) {

  // Alert State
  const [showAlert, setShowAlert] = useState<AlertState>(null)

  // File state
  const [files, setFiles] = useState<(TFolder | TFile)[]>([])

  // Apply Button merger decoration state
  const [mergeDecorationsCollection, setMergeDecorationsCollection] =
    useState<monaco.editor.IEditorDecorationsCollection>()

  const isOwner = sandboxData.userId === userData.id

  // Layout management
  const {
    isHorizontalLayout,
    isPreviewCollapsed,
    isAIChatOpen,
    previewURL,
    disableAccess,
    terminals,
    editorContainerRef,
    editorPanelRef,
    previewWindowRef,
    togglePreviewPanel,
    toggleLayout,
    toggleAIChat,
    loadPreviewURL,
    setDisableAccess,
    setIsAIChatOpen,
    setIsPreviewCollapsed,
  } = useEditorLayout({ isOwner })

  // Socket handlers
  const { socketHandlers } = useSocketHandlers({
    isOwner,
    terminals,
    setFiles,
    setDisableAccess,
    loadPreviewURL,
  })
  // Socket management
  const { socket, timeoutDialog, setTimeoutDialog } = useEditorSocket({
    userData,
    sandboxData,
    isOwner,
    terminals,
    handlers: socketHandlers,
  })

  // Monaco editor management
  const {
    editorRef,
    cursorLine,
    isSelected,
    showSuggestion,
    generate,
    setGenerate,
    generateRef,
    suggestionRef,
    generateWidgetRef,
    lastCopiedRangeRef,
    handleEditorWillMount,
    handleEditorMount,
    handleAiEdit,
  } = useMonacoEditor({
    socket,
    files,
    editorPanelRef,
    setIsAIChatOpen: (value) => {
      if (typeof value === "function") {
        setIsAIChatOpen((prev) => value(prev))
      } else {
        setIsAIChatOpen(value)
      }

    },
  })

  // File management
  const {
    tabs,
    activeFileId,
    activeFileContent,
    editorLanguage,
    hasUnsavedFiles,
    selectFile,
    prefetchFile,
    closeTab,
    handleRename,
    handleDeleteFile,
    handleDeleteFolder,
    saveFile,
    updateActiveFileContent,
    setActiveFileId,
    setTabs,
  } = useFileManager({
    socket,
    setGenerate,
    setShowAlert,
  })

  // Code diff and merge logic
  const { handleApplyCode } = useCodeDiffer({
    editorRef: editorRef || null,
  })

  // Wrapper for handleApplyCode to manage decorations collection state
  const handleApplyCodeWithDecorations = useCallback(
    (mergedCode: string, originalCode: string) => {
      const decorationsCollection = handleApplyCode(mergedCode, originalCode)
      if (decorationsCollection) {
        setMergeDecorationsCollection(decorationsCollection)
      }
    },
    [handleApplyCode]
  )

  // Generate widget handlers
  const { generateInputProps } = useGenerateWidget({
    editorRef,
    generate,
    setGenerate,
    isSelected,
    cursorLine,
    generateRef,
    tabs,
    activeFileId,
    editorLanguage,
  })

  // Copilot elements management
  const { copilotElementsProps } = useCopilotElements({
    generateRef,
    suggestionRef,
    generateWidgetRef,
    isSelected,
    showSuggestion,
    handleAiEdit,
    generate,
    userData,
    generateInputProps,
  })

  // Keyboard shortcuts and browser events
  useEditorShortcuts({
    hasUnsavedFiles,
    activeFileId,
    saveFile,
    toggleAIChat,
  })

  // Changes alert logic
  const { handleAlertAccept } = useChangesAlert({
    tabs,
    activeFileId,
    setTabs,
    setActiveFileId,
    selectFile,
  })

  // On disabled access for shared users, show un-interactable loading placeholder + info modal
  if (disableAccess.isDisabled)
    return (
      <>
        <DisableAccessModal
          message={disableAccess.message}
          open={disableAccess.isDisabled}
          setOpen={() => {}}
        />
        <Loading />
      </>
    )

  return (
    <div className="flex max-h-full overflow-hidden">
      <ChangesAlert
        state={showAlert}
        setState={setShowAlert}
        onAccept={() => handleAlertAccept(showAlert)}
      />
      <PreviewProvider>
        {/* Copilot elements */}
        <CopilotElements {...copilotElementsProps} />

        {/* Sidebar */}
        <Sidebar
          sandboxData={sandboxData}
          files={files}
          selectFile={selectFile}
          prefetchFile={prefetchFile}
          handleRename={handleRename}
          handleDeleteFile={handleDeleteFile}
          handleDeleteFolder={handleDeleteFolder}
          setFiles={setFiles}
          deletingFolderId=""
          toggleAIChat={toggleAIChat}
          isAIChatOpen={isAIChatOpen}
        />

        {/* Main Editor Layout */}
        <EditorLayout
          isHorizontalLayout={isHorizontalLayout}
          isPreviewCollapsed={isPreviewCollapsed}
          isAIChatOpen={isAIChatOpen}
          previewURL={previewURL}
          isOwner={isOwner}
          tabs={tabs}
          activeFileId={activeFileId}
          activeFileContent={activeFileContent}
          editorLanguage={editorLanguage}
          files={files}
          editorPanelRef={editorPanelRef}
          editorContainerRef={editorContainerRef}
          previewWindowRef={previewWindowRef}
          editorRef={editorRef}
          lastCopiedRangeRef={lastCopiedRangeRef}
          selectFile={selectFile}
          closeTab={closeTab}
          updateActiveFileContent={updateActiveFileContent}
          toggleLayout={toggleLayout}
          toggleAIChat={toggleAIChat}
          togglePreviewPanel={togglePreviewPanel}
          setIsPreviewCollapsed={setIsPreviewCollapsed}
          handleEditorWillMount={handleEditorWillMount}
          handleEditorMount={handleEditorMount}
          handleApplyCodeWithDecorations={handleApplyCodeWithDecorations}
          mergeDecorationsCollection={mergeDecorationsCollection}
          setMergeDecorationsCollection={setMergeDecorationsCollection}
          sandboxData={sandboxData}
        />
      </PreviewProvider>

      {/* Session Timeout Dialog */}
      <Dialog open={timeoutDialog} onOpenChange={setTimeoutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <X className="h-5 w-5 text-destructive" />
              Session Timeout
            </DialogTitle>
            <DialogDescription className="pt-2">
              Your project session has timed out. Please refresh the page to
              continue working.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button variant="default" onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
