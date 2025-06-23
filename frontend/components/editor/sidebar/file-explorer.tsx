"use client"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { useEditorLayout } from "@/context/EditorLayoutContext"
import type { Sandbox } from "@/lib/types"
import { cn } from "@/lib/utils"
import { DragDropProvider, useDroppable } from "@dnd-kit/react"
import { FilePlus, FolderPlus, MessageSquareMore, Sparkles } from "lucide-react"
import { useParams } from "next/navigation"
import * as React from "react"
import { useFileTree } from "../hooks/useFile"
import SidebarFile from "./file"
import SidebarFolder from "./folder"
import New from "./new"

interface FileExplorerProps {
  sandboxData: Sandbox
}

export function FileExplorer() {
  const { id: projectId } = useParams<{ id: string }>()

  const { moveFile } = useFileTree()

  return (
    <DragDropProvider
      onDragEnd={(event) => {
        if (event.canceled) return
        const { source, target } = event.operation

        if (source && target) {
          if (source.type === "file" && target.type === "folder") {
            const fileId = source.id.toString() // e.g. "/src/hello.ts"
            const targetFolderId = target.id.toString() // e.g. "/src"

            // compute the file's current folder:
            const idx = fileId.lastIndexOf("/")
            const currentFolderId = fileId.substring(0, idx)
            if (currentFolderId === targetFolderId) return
            moveFile({
              projectId,
              folderId: targetFolderId,
              fileId,
            })
          }
        }
      }}
    >
      <RootFolder />
      <AIChatControl />
    </DragDropProvider>
  )
}

function RootFolder() {
  const { id: projectId } = useParams<{ id: string }>()
  const [creatingNew, setCreatingNew] = React.useState<
    "file" | "folder" | null
  >(null)
  const { fileTree, isLoadingFileTree } = useFileTree()
  const { ref: droppableRef, isDropTarget } = useDroppable({
    id: "/",
    type: "folder",
    accept(source) {
      if (source.type === "file" || source.type === "folder") {
        return true
      }
      return false
    },
  })
  return (
    <ScrollArea
      ref={droppableRef}
      data-isdrop={isDropTarget}
      className="flex-grow overflow-auto px-2 pt-0 pb-4 relative data-[isdrop=true]:bg-secondary/50 data-[isdrop=true]:rounded-sm data-[isdrop=true]:overflow-hidden"
    >
      <div className="flex w-full items-center justify-between h-8 pb-1 isolate z-10 sticky pt-2 top-0 bg-background">
        <h2 className="font-medium">Explorer</h2>
        <div className="flex space-x-1">
          <button
            disabled={!!creatingNew}
            onClick={() => setCreatingNew("file")}
            className="h-6 w-6 text-muted-foreground ml-0.5 flex items-center justify-center translate-x-1 bg-transparent hover:bg-muted-foreground/25 cursor-pointer rounded-sm transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 disabled:hover:bg-background"
          >
            <FilePlus className="w-4 h-4" />
          </button>
          <button
            disabled={!!creatingNew}
            onClick={() => setCreatingNew("folder")}
            className="h-6 w-6 text-muted-foreground ml-0.5 flex items-center justify-center translate-x-1 bg-transparent hover:bg-muted-foreground/25 cursor-pointer rounded-sm transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 disabled:hover:bg-background"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="rounded-sm w-full mt-1 flex flex-col">
        {isLoadingFileTree ? (
          <div className="w-full flex flex-col justify-center">
            {new Array(6).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-[1.625rem] mb-0.5 rounded-sm" />
            ))}
          </div>
        ) : (
          <>
            {fileTree.map((child) =>
              child.type === "file" ? (
                <SidebarFile key={child.id} {...child} />
              ) : (
                <SidebarFolder key={child.id} {...child} />
              )
            )}
            {creatingNew !== null ? (
              <New
                projectId={projectId}
                type={creatingNew}
                stopEditing={() => {
                  setCreatingNew(null)
                }}
              />
            ) : null}
          </>
        )}
      </div>
    </ScrollArea>
  )
}

function AIChatControl() {
  const { toggleAIChat, isAIChatOpen } = useEditorLayout()

  return (
    <div className="flex flex-col p-2 bg-background">
      <Button
        variant="ghost"
        className="w-full justify-start text-sm text-muted-foreground font-normal h-8 px-2 mb-2"
        disabled
        aria-disabled="true"
        style={{ opacity: 1 }}
      >
        <Sparkles className="h-4 w-4 mr-2 text-indigo-500 opacity-70" />
        AI Editor
        <div className="ml-auto">
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>G
          </kbd>
        </div>
      </Button>
      <Button
        variant="ghost"
        className={cn(
          "w-full justify-start text-sm font-normal h-8 px-2 mb-2 border-t",
          isAIChatOpen
            ? "bg-muted-foreground/25 text-foreground"
            : "text-muted-foreground"
        )}
        onClick={toggleAIChat}
        aria-disabled={false}
        style={{ opacity: 1 }}
      >
        <MessageSquareMore
          className={cn(
            "h-4 w-4 mr-2",
            isAIChatOpen ? "text-indigo-500" : "text-indigo-500 opacity-70"
          )}
        />
        AI Chat
        <div className="ml-auto">
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>L
          </kbd>
        </div>
      </Button>
    </div>
  )
}
