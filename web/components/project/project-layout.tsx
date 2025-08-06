"use client"

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { useEditorLayout } from "@/context/EditorLayoutContext"
import { fileRouter } from "@/lib/api"
import { defaultEditorOptions } from "@/lib/monaco/config"
import { TFile } from "@/lib/types"
import { processFileType, sortFileExplorer } from "@/lib/utils"
import { useAppStore } from "@/store/context"
import Editor from "@monaco-editor/react"
import { FileJson, TerminalSquare } from "lucide-react"
import * as monaco from "monaco-editor"
import { useTheme } from "next-themes"
import { useParams } from "next/navigation"
import { useCallback, useMemo, useRef, useState } from "react"
import { ImperativePanelHandle } from "react-resizable-panels"
import Tab from "../ui/tab"
import AIChat from "./ai-chat"
import AIEditElements from "./ai-edit/ai-edit-elements"
import { SessionTimeoutDialog } from "./alerts/session-timeout-dialog"
import { useCodeDiffer } from "./hooks/useCodeDiffer"
import { useEditorSocket } from "./hooks/useEditorSocket"
import { useMonacoEditor } from "./hooks/useMonacoEditor"
import { PreviewWindow } from "./preview"
import Terminals from "./terminals"
export interface ProjectLayoutProps {
  isOwner: boolean
  projectName: string
  projectType: string
}

/**
 * Main editor layout component that handles the resizable panels structure,
 * Monaco editor, preview window, terminals, and AI chat
 */
export default function ProjectLayout({
  isOwner,
  projectName,
  projectType,
}: ProjectLayoutProps) {
  const { id: projectId } = useParams<{ id: string }>()
  const { resolvedTheme: theme } = useTheme()
  // Store States
  const tabs = useAppStore((s) => s.tabs)
  const activeTab = useAppStore((s) => s.activeTab)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const removeTab = useAppStore((s) => s.removeTab)
  const draft = useAppStore((s) => s.drafts[activeTab?.id ?? ""])
  const setDraft = useAppStore((s) => s.setDraft)
  const editorLanguage = activeTab?.name
    ? processFileType(activeTab.name)
    : "plaintext"

  const { data: serverActiveFile = "" } = fileRouter.fileContent.useQuery({
    enabled: !!activeTab?.id,
    variables: {
      fileId: activeTab?.id ?? "",
      projectId,
    },
    select(data) {
      return data.data
    },
  })

  const activeFileContent = draft === undefined ? serverActiveFile : draft
  // Layout refs
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const editorPanelRef = useRef<ImperativePanelHandle>(null)
  const previewWindowRef = useRef<{ refreshIframe: () => void }>(null)

  // Apply Button merger decoration state
  const [mergeDecorationsCollection, setMergeDecorationsCollection] =
    useState<monaco.editor.IEditorDecorationsCollection>()

  // Editor layout and state management
  const {
    isHorizontalLayout,
    isPreviewCollapsed,
    isAIChatOpen,
    toggleAIChat,
    loadPreviewURL,
    setIsAIChatOpen,
    setIsPreviewCollapsed,
    previewPanelRef,
  } = useEditorLayout()

  const { data: fileTree = [] } = fileRouter.fileTree.useQuery({
    variables: {
      projectId,
    },
    select(data) {
      return sortFileExplorer(data.data ?? [])
    },
  })

  useEditorSocket({
    loadPreviewURL,
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
    editorPanelRef,
    setIsAIChatOpen,
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

  const updateActiveFileContent = (content?: string) => {
    if (!activeTab) {
      return
    }
    setDraft(activeTab.id, content ?? "")
  }

  const previewPanelProps = useMemo(
    () => ({
      onCollapse: () => {
        setIsPreviewCollapsed(true)
        const previewPanel = document.querySelector(
          ".preview-panel"
        ) as HTMLDivElement
        if (previewPanel) {
          previewPanel.style.transition = ""
        }
      },

      onExpand: () => {
        setIsPreviewCollapsed(false)
        const previewPanel = document.querySelector(
          ".preview-panel"
        ) as HTMLDivElement
        if (previewPanel) {
          previewPanel.style.transition = ""
        }
      },
      onResize: () => {
        const previewPanel = document.querySelector(
          ".preview-panel"
        ) as HTMLDivElement
        if (previewPanel) {
          previewPanel.style.transition = "none"
        }
      },
    }),
    [setIsPreviewCollapsed]
  )
  return (
    <ResizablePanelGroup
      direction={isHorizontalLayout ? "horizontal" : "vertical"}
    >
      <ResizablePanel defaultSize={isAIChatOpen ? 80 : 100} minSize={50}>
        <ResizablePanelGroup
          direction={isHorizontalLayout ? "vertical" : "horizontal"}
        >
          {/* Editor Panel */}
          <ResizablePanel
            className="p-2 flex flex-col"
            maxSize={80}
            minSize={30}
            defaultSize={70}
            ref={editorPanelRef}
          >
            {/* Tabs */}
            <div className="pb-2 w-full flex gap-2 overflow-x-auto tab-scroll">
              {tabs.map((tab) => (
                <Tab
                  key={tab.id}
                  saved={tab.saved}
                  selected={activeTab?.id === tab.id}
                  onClick={() => setActiveTab(tab)}
                  onClose={() => removeTab(tab)}
                >
                  {tab.name}
                </Tab>
              ))}
            </div>

            {/* Monaco Editor Container */}
            <div
              ref={editorContainerRef}
              className="grow w-full overflow-hidden rounded-md relative"
            >
              {!activeTab?.id ? (
                <div className="w-full h-full flex items-center justify-center text-xl font-medium text-muted-foreground/50 select-none">
                  <FileJson className="w-6 h-6 mr-3" />
                  No file selected.
                </div>
              ) : (
                <>
                  <Editor
                    height="100%"
                    language={editorLanguage}
                    beforeMount={handleEditorWillMount}
                    onMount={handleEditorMount}
                    path={activeTab.id}
                    onChange={updateActiveFileContent}
                    theme={theme === "light" ? "vs" : "vs-dark"}
                    options={defaultEditorOptions}
                    value={activeFileContent}
                  />
                  <AIEditElements
                    editorRef={editorRef}
                    cursorLine={cursorLine}
                    isSelected={isSelected}
                    showSuggestion={showSuggestion}
                    generate={generate}
                    setGenerate={setGenerate}
                    generateRef={generateRef}
                    suggestionRef={suggestionRef}
                    generateWidgetRef={generateWidgetRef}
                    handleAiEdit={handleAiEdit}
                    tabs={tabs}
                    activeFileId={activeTab.id}
                    editorLanguage={editorLanguage}
                  />
                </>
              )}
            </div>
          </ResizablePanel>

          <ResizableHandle />

          {/* Preview & Terminal Panel */}
          <ResizablePanel defaultSize={30}>
            <ResizablePanelGroup
              direction={
                isAIChatOpen && isHorizontalLayout
                  ? "horizontal"
                  : isAIChatOpen
                  ? "vertical"
                  : isHorizontalLayout
                  ? "horizontal"
                  : "vertical"
              }
            >
              {/* Preview Panel */}
              <ResizablePanel
                ref={previewPanelRef}
                defaultSize={isPreviewCollapsed ? 4 : 50}
                minSize={25}
                collapsedSize={isHorizontalLayout ? 50 : 4}
                className="preview-panel p-2 transition-all duration-300 ease-in-out"
                collapsible
                {...previewPanelProps}
              >
                <PreviewWindow ref={previewWindowRef} />
              </ResizablePanel>

              <ResizableHandle />

              {/* Terminal Panel */}
              <ResizablePanel
                defaultSize={50}
                minSize={20}
                className="p-2 flex flex-col"
              >
                {isOwner ? (
                  <Terminals />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg font-medium text-muted-foreground/50 select-none">
                    <TerminalSquare className="w-4 h-4 mr-2" />
                    No terminal access.
                  </div>
                )}
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>

      {/* AI Chat Panel */}
      {isAIChatOpen && (
        <>
          <ResizableHandle />
          <ResizablePanel defaultSize={30} minSize={15}>
            <AIChat
              activeFileContent={activeFileContent}
              activeFileName={activeTab?.name || "No file selected"}
              onClose={toggleAIChat}
              editorRef={{ current: editorRef }}
              lastCopiedRangeRef={lastCopiedRangeRef}
              templateType={projectType}
              projectName={projectName}
              handleApplyCode={handleApplyCodeWithDecorations}
              mergeDecorationsCollection={mergeDecorationsCollection}
              setMergeDecorationsCollection={setMergeDecorationsCollection}
              selectFile={setActiveTab}
              tabs={tabs}
              projectId={projectId}
              files={fileTree as TFile[]}
            />
          </ResizablePanel>
        </>
      )}
      {/* Session Timeout Dialog */}
      <SessionTimeoutDialog isOwner={isOwner} />
    </ResizablePanelGroup>
  )
}
