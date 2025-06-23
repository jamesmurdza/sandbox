"use client"

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { TFolder } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useDraggable, useDroppable } from "@dnd-kit/react"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronRight, Pencil, Trash2 } from "lucide-react"
import Image from "next/image"
import { useParams } from "next/navigation"
import { LegacyRef, memo, useEffect, useRef, useState } from "react"
import { mergeRefs } from "react-merge-refs"
import { getIconForFolder, getIconForOpenFolder } from "vscode-icons-js"
import { useFileTree } from "../hooks/useFile"
import SidebarFile from "./file"

// Note: Renaming has not been implemented in the backend yet, so UI relating to renaming is commented out
const SidebarFolder = memo((props: TFolder) => {
  const { id: projectId } = useParams<{ id: string }>()
  const [isOpen, setIsOpen] = useState(false)
  const { deleteFolder, isDeletingFolder } = useFileTree()

  const folder = isOpen
    ? getIconForOpenFolder(props.name)
    : getIconForFolder(props.name)

  const inputRef = useRef<HTMLInputElement>(null)
  const { ref: droppableRef, isDropTarget } = useDroppable({
    id: props.id,
    type: props.type,
    accept(source) {
      if (source.type === "file" || source.type === "folder") {
        return true
      }
      return false
    },
  })
  const { ref: draggableRef } = useDraggable({
    id: props.id,
    type: props.type,
    feedback: "clone",
  })

  useEffect(() => {
    let timeOut: NodeJS.Timeout | null = null
    if (isDropTarget) {
      timeOut = setTimeout(() => {
        setIsOpen(true)
      }, 800)
    }
    return () => {
      timeOut ? clearTimeout(timeOut) : null
    }
  }, [isDropTarget])
  return (
    <div
      ref={mergeRefs([draggableRef, droppableRef]) as LegacyRef<HTMLDivElement>}
      data-isdrop={isDropTarget}
      className="data-[isdrop=true]:bg-secondary/50 data-[isdrop=true]:rounded-sm data-[isdrop=true]:overflow-hidden"
    >
      <ContextMenu>
        <ContextMenuTrigger
          disabled={isDeletingFolder}
          onClick={() => setIsOpen((prev) => !prev)}
          className={cn(
            "rounded-sm w-full flex items-center h-7 px-1 transition-colors hover:bg-secondary cursor-pointer"
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
                defaultValue={props.name}
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
                folderId: props.id,
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
              className={cn(
                // isDraggedOver ? "rounded-b-sm bg-secondary/50" : "",
                "overflow-y-hidden flex flex-col grow ml-2 pl-2 border-l border-border"
              )}
            >
              {props.children.map((child) =>
                child.type === "file" ? (
                  <SidebarFile key={child.id} {...child} />
                ) : (
                  <SidebarFolder key={child.id} {...child} />
                )
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </ContextMenu>
    </div>
  )
})

export default SidebarFolder
