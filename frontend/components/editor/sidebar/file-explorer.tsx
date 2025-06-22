"use client"

import { apiClient } from "@/server/client"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { useSocket } from "@/context/SocketContext"
import { fileRouter } from "@/lib/api"
import type { Sandbox } from "@/lib/types"
import { cn, sortFileExplorer } from "@/lib/utils"
import {
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter"
import { FilePlus, FolderPlus, MessageSquareMore, Sparkles } from "lucide-react"
import * as React from "react"
import SidebarFile from "./file"
import SidebarFolder from "./folder"
import New from "./new"

interface FileExplorerProps {
  sandboxData: Sandbox
  toggleAIChat: () => void
  isAIChatOpen: boolean
}

export function FileExplorer({
  sandboxData,
  toggleAIChat,
  isAIChatOpen,
}: FileExplorerProps) {
  const { socket } = useSocket()
  const [creatingNew, setCreatingNew] = React.useState<
    "file" | "folder" | null
  >(null)
  const [movingId, setMovingId] = React.useState("")
  const ref = React.useRef(null) // drop target

  const { data: files = [] } = fileRouter.fileTree.useQuery({
    variables: {
      projectId: sandboxData.id,
    },
    select(data) {
      return sortFileExplorer(data.data ?? [])
    },
  })

  React.useEffect(() => {
    const el = ref.current

    if (el) {
      return dropTargetForElements({
        element: el,
        // TODO: LL
        getData: () => ({ id: `/` }),
        canDrop: ({ source }) => {
          const file = files.find((child) => child.id === source.data.id)
          return !file
        },
      })
    }
  }, [files, sandboxData.id])

  React.useEffect(() => {
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
        apiClient.file.move
          .$post({
            json: {
              fileId,
              projectId: sandboxData.id,
              folderId,
            },
          })
          .then(async (res) => {
            if (res.status === 200) {
              setMovingId("")
            }
          })
      },
    })
  }, [socket])

  return (
    <>
      <ScrollArea className="flex-grow overflow-auto px-2 pt-0 pb-4 relative">
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
        <div ref={ref} className="rounded-sm w-full mt-1 flex flex-col">
          {files.length === 0 ? (
            <div className="w-full flex flex-col justify-center">
              {new Array(6).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-[1.625rem] mb-0.5 rounded-sm" />
              ))}
            </div>
          ) : (
            <>
              {files.map((child) =>
                child.type === "file" ? (
                  <SidebarFile
                    key={child.id}
                    data={child}
                    movingId={movingId}
                  />
                ) : (
                  <SidebarFolder
                    key={child.id}
                    data={child}
                    movingId={movingId}
                  />
                )
              )}
              {creatingNew !== null ? (
                <New
                  projectId={sandboxData.id}
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
    </>
  )
}
