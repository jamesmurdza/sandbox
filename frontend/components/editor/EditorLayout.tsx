"use client"

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { defaultEditorOptions } from "@/lib/monaco/config"
import { Sandbox, TFile, TFolder, TTab } from "@/lib/types"
import { useClerk } from "@clerk/nextjs"
import Editor from "@monaco-editor/react"
import {
  ArrowDownToLine,
  ArrowRightToLine,
  FileJson,
  Loader2,
  TerminalSquare,
} from "lucide-react"
import * as monaco from "monaco-editor"
import { useTheme } from "next-themes"
import { Button } from "../ui/button"
import Tab from "../ui/tab"
import AIChat from "./AIChat"
import PreviewWindow from "./preview"
import Terminals from "./terminals"

export interface EditorLayoutProps {
  // Layout state
  isHorizontalLayout: boolean
  isPreviewCollapsed: boolean
  isAIChatOpen: boolean
  previewURL: string
  isOwner: boolean

  // File state
  tabs: TTab[]
  activeFileId: string
  activeFileContent: string
  editorLanguage: string
  files: (TFolder | TFile)[]

  // Refs
  editorPanelRef: React.RefObject<any>
  editorContainerRef: React.RefObject<HTMLDivElement>
  previewWindowRef: React.RefObject<any>
  editorRef: monaco.editor.IStandaloneCodeEditor | undefined
  lastCopiedRangeRef: React.MutableRefObject<{
    startLine: number
    endLine: number
  } | null>

  // Actions
  selectFile: (tab: TTab) => void
  closeTab: (tabId: string) => void
  updateActiveFileContent: (content: string) => void
  toggleLayout: () => void
  toggleAIChat: () => void
  togglePreviewPanel: () => void
  setIsPreviewCollapsed: (collapsed: boolean) => void

  // Monaco handlers
  handleEditorWillMount: (monaco: any) => void
  handleEditorMount: (
    editor: monaco.editor.IStandaloneCodeEditor,
    monaco: any
  ) => void

  // AI Chat props
  handleApplyCodeWithDecorations: (
    mergedCode: string,
    originalCode: string
  ) => void
  mergeDecorationsCollection:
    | monaco.editor.IEditorDecorationsCollection
    | undefined
  setMergeDecorationsCollection: React.Dispatch<
    React.SetStateAction<monaco.editor.IEditorDecorationsCollection | undefined>
  >

  // Sandbox data
  sandboxData: Sandbox
}

/**
 * Main editor layout component that handles the resizable panels structure,
 * Monaco editor, preview window, terminals, and AI chat
 */
export default function EditorLayout({
  isHorizontalLayout,
  isPreviewCollapsed,
  isAIChatOpen,
  previewURL,
  isOwner,
  tabs,
  activeFileId,
  activeFileContent,
  editorLanguage,
  files,
  editorPanelRef,
  editorContainerRef,
  previewWindowRef,
  editorRef,
  lastCopiedRangeRef,
  selectFile,
  closeTab,
  updateActiveFileContent,
  toggleLayout,
  toggleAIChat,
  togglePreviewPanel,
  setIsPreviewCollapsed,
  handleEditorWillMount,
  handleEditorMount,
  handleApplyCodeWithDecorations,
  mergeDecorationsCollection,
  setMergeDecorationsCollection,
  sandboxData,
}: EditorLayoutProps) {
  const { resolvedTheme: theme } = useTheme()
  const clerk = useClerk()

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
                  selected={activeFileId === tab.id}
                  onClick={() => selectFile(tab)}
                  onClose={() => closeTab(tab.id)}
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
              {!activeFileId ? (
                <div className="w-full h-full flex items-center justify-center text-xl font-medium text-muted-foreground/50 select-none">
                  <FileJson className="w-6 h-6 mr-3" />
                  No file selected.
                </div>
              ) : clerk.loaded ? (
                <Editor
                  height="100%"
                  language={editorLanguage}
                  beforeMount={handleEditorWillMount}
                  onMount={handleEditorMount}
                  path={activeFileId}
                  onChange={(value) => updateActiveFileContent(value ?? "")}
                  theme={theme === "light" ? "vs" : "vs-dark"}
                  options={defaultEditorOptions}
                  value={activeFileContent}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xl font-medium text-muted-foreground/50 select-none">
                  <Loader2 className="animate-spin w-6 h-6 mr-3" />
                  Waiting for Clerk to load...
                </div>
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
                defaultSize={isPreviewCollapsed ? 4 : 20}
                minSize={25}
                collapsedSize={isHorizontalLayout ? 20 : 4}
                className="p-2 flex flex-col gap-2"
                collapsible
                onCollapse={() => setIsPreviewCollapsed(true)}
                onExpand={() => setIsPreviewCollapsed(false)}
              >
                <div className="flex items-center justify-between">
                  <Button
                    onClick={toggleLayout}
                    size="sm"
                    variant="ghost"
                    className="mr-2 border"
                    disabled={isAIChatOpen}
                  >
                    {isHorizontalLayout ? (
                      <ArrowRightToLine className="w-4 h-4" />
                    ) : (
                      <ArrowDownToLine className="w-4 h-4" />
                    )}
                  </Button>
                  <PreviewWindow
                    open={togglePreviewPanel}
                    collapsed={isPreviewCollapsed}
                    src={previewURL}
                    ref={previewWindowRef}
                  />
                </div>
                {!isPreviewCollapsed && (
                  <div className="w-full grow rounded-md overflow-hidden bg-background mt-2">
                    <iframe width="100%" height="100%" src={previewURL} />
                  </div>
                )}
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
              activeFileName={
                tabs.find((tab) => tab.id === activeFileId)?.name ||
                "No file selected"
              }
              onClose={toggleAIChat}
              editorRef={{ current: editorRef }}
              lastCopiedRangeRef={lastCopiedRangeRef}
              files={files}
              templateType={sandboxData.type}
              projectName={sandboxData.name}
              handleApplyCode={handleApplyCodeWithDecorations}
              mergeDecorationsCollection={mergeDecorationsCollection}
              setMergeDecorationsCollection={setMergeDecorationsCollection}
              selectFile={selectFile}
              tabs={tabs}
            />
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  )
}
