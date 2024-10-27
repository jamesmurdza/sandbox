"use client"

import { Sandbox, TFile, TFolder, TTab } from "@/lib/types"
import { FilePlus, FolderPlus, MessageSquareMore, Sparkles } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Socket } from "socket.io-client"
import SidebarFile from "./file"
import SidebarFolder from "./folder"
import New from "./new"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn, sortFileExplorer } from "@/lib/utils"
import {
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter"

export default function Sidebar({
  sandboxData,
  files,
  selectFile,
  handleRename,
  handleDeleteFile,
  handleDeleteFolder,
  socket,
  setFiles,
  addNew,
  deletingFolderId,
  toggleAIChat,
  isAIChatOpen,
}: {
  sandboxData: Sandbox
  files: (TFile | TFolder)[]
  selectFile: (tab: TTab) => void
  handleRename: (
    id: string,
    newName: string,
    oldName: string,
    type: "file" | "folder"
  ) => boolean
  handleDeleteFile: (file: TFile) => void
  handleDeleteFolder: (folder: TFolder) => void
  socket: Socket
  setFiles: (files: (TFile | TFolder)[]) => void
  addNew: (name: string, type: "file" | "folder") => void
  deletingFolderId: string
  toggleAIChat: () => void
  isAIChatOpen: boolean
}) {
  const ref = useRef(null) // drop target

  const [creatingNew, setCreatingNew] = useState<"file" | "folder" | null>(null)
  const [movingId, setMovingId] = useState("")
  const sortedFiles = useMemo(() => {
    return sortFileExplorer(files)
  }, [files])
  useEffect(() => {
    const el = ref.current

    if (el) {
      return dropTargetForElements({
        element: el,
        getData: () => ({ id: `projects/${sandboxData.id}` }),
        canDrop: ({ source }) => {
          const file = files.find((child) => child.id === source.data.id)
          return !file
        },
      })
    }
  }, [files])

  useEffect(() => {
    return monitorForElements({
      onDrop({ source, location }) {
        const destination = location.current.dropTargets[0]
        if (!destination) {
          return
        }

        const fileId = source.data.id as string
        const folderId = destination.data.id as string

        const fileFolder = fileId.split("/").slice(0, -1).join("/")
        if (fileFolder === folderId) {
          return
        }

        console.log("move file", fileId, "to folder", folderId)

        setMovingId(fileId)
        socket.emit(
          "moveFile",
          {
            fileId,
            folderId
          },
          (response: (TFolder | TFile)[]) => {
            setFiles(response)
            setMovingId("")
          }
        )
      },
    })
  }, [])

  return (
    <div className="h-full w-56 select-none flex flex-col text-sm">
      <div className="flex-grow overflow-auto p-2 pb-[84px]">
        <div className="flex w-full items-center justify-between h-8 mb-1">
          <div className="text-muted-foreground">Explorer</div>
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
            {/* Todo: Implement file searching */}
            {/* <button className="h-6 w-6 text-muted-foreground ml-0.5 flex items-center justify-center translate-x-1 bg-transparent hover:bg-muted-foreground/25 cursor-pointer rounded-sm transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <Search className="w-4 h-4" />
          </button> */}
          </div>
        </div>
        <div ref={ref} className="rounded-sm w-full mt-1 flex flex-col">
          {/* <div
          ref={ref}
          className={`${
            isDraggedOver ? "bg-secondary/50" : ""
          } rounded-sm w-full mt-1 flex flex-col`}
        > */}
          {sortedFiles.length === 0 ? (
            <div className="w-full flex flex-col justify-center">
              {new Array(6).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-[1.625rem] mb-0.5 rounded-sm" />
              ))}
            </div>
          ) : (
            <>
              {sortedFiles.map((child) =>
                child.type === "file" ? (
                  <SidebarFile
                    key={child.id}
                    data={child}
                    selectFile={selectFile}
                    handleRename={handleRename}
                    handleDeleteFile={handleDeleteFile}
                    movingId={movingId}
                    deletingFolderId={deletingFolderId}
                  />
                ) : (
                  <SidebarFolder
                    key={child.id}
                    data={child}
                    selectFile={selectFile}
                    handleRename={handleRename}
                    handleDeleteFile={handleDeleteFile}
                    handleDeleteFolder={handleDeleteFolder}
                    movingId={movingId}
                    deletingFolderId={deletingFolderId}
                  />
                )
              )}
              {creatingNew !== null ? (
                <New
                  socket={socket}
                  type={creatingNew}
                  stopEditing={() => {
                    setCreatingNew(null)
                  }}
                  addNew={addNew}
                />
              ) : null}
            </>
          )}
        </div>
      </div>
      <div className="fixed bottom-0 w-48 flex flex-col p-2 bg-background">
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
              isAIChatOpen 
                ? "text-indigo-500" 
                : "text-indigo-500 opacity-70"
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
    </div>
  )
}
