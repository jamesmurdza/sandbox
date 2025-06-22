"use client"

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { TFolder } from "@/lib/types"
import { cn } from "@/lib/utils"
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter"
import { useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronRight, Pencil, Trash2 } from "lucide-react"
import Image from "next/image"
import { useParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { getIconForFolder, getIconForOpenFolder } from "vscode-icons-js"
import { useFileTree } from "../hooks/useFile"
import SidebarFile from "./file"

// Note: Renaming has not been implemented in the backend yet, so UI relating to renaming is commented out

export default function SidebarFolder({
  data,
  movingId,
}: {
  data: TFolder
  movingId: string
}) {
  const { id: projectId } = useParams<{ id: string }>()
  const ref = useRef(null) // drop target
  const [isDraggedOver, setIsDraggedOver] = useState(false)
  const queryClient = useQueryClient()
  const { deleteFolder, isDeletingFolder } = useFileTree()
  useEffect(() => {
    const el = ref.current

    if (el)
      return dropTargetForElements({
        element: el,
        onDragEnter: () => setIsDraggedOver(true),
        onDragLeave: () => setIsDraggedOver(false),
        onDrop: () => setIsDraggedOver(false),
        getData: () => ({ id: data.id }),
        canDrop: () => {
          return !movingId
        },
      })
  }, [])

  const [isOpen, setIsOpen] = useState(false)
  const folder = isOpen
    ? getIconForOpenFolder(data.name)
    : getIconForFolder(data.name)

  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <ContextMenu>
      <ContextMenuTrigger
        ref={ref}
        disabled={isDeletingFolder}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          isDraggedOver ? "bg-secondary/50 rounded-t-sm" : "rounded-sm",
          "w-full flex items-center h-7 px-1 transition-colors hover:bg-secondary cursor-pointer"
        )}
      >
        <ChevronRight
          className={cn(
            "min-w-3 min-h-3 mr-1 ml-auto transition-all duration-300",
            isOpen ? "transform rotate-90" : ""
          )}
        />
        <Image
          src={`/icons/${folder}`}
          alt="Folder icon"
          width={18}
          height={18}
          className="mr-2"
        />
        {isDeletingFolder ? (
          <div className="w-full text-muted-foreground animate-pulse">
            Deleting...
          </div>
        ) : (
          <form>
            <input
              ref={inputRef}
              disabled
              className={`pointer-events-none bg-transparent transition-all focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-ring rounded-sm w-full`}
              defaultValue={data.name}
            />
          </form>
        )}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem disabled>
          <Pencil className="w-4 h-4 mr-2" />
          Rename
        </ContextMenuItem>
        <ContextMenuItem
          disabled={isDeletingFolder}
          onClick={() => {
            deleteFolder({
              folderId: data.id,
              projectId,
            })
          }}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
      <AnimatePresence>
        {isOpen ? (
          <motion.div
            className="overflow-y-hidden"
            initial={{
              height: 0,
              opacity: 0,
            }}
            animate={{
              height: "auto",
              opacity: 1,
            }}
            exit={{
              height: 0,
              opacity: 0,
            }}
          >
            <div
              className={cn(
                isDraggedOver ? "rounded-b-sm bg-secondary/50" : ""
              )}
            >
              <div className="flex flex-col grow ml-2 pl-2 border-l border-border">
                {data.children.map((child) =>
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
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </ContextMenu>
  )
}
