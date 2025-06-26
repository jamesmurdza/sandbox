"use client"

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { TFile } from "@/lib/types"
import { Pencil, Trash2 } from "lucide-react"
import Image from "next/image"
import { memo, useEffect, useRef, useState } from "react"
import { getIconForFile } from "vscode-icons-js"

import { fileRouter } from "@/lib/api"
import { useAppStore } from "@/store/context"
import { useDraggable } from "@dnd-kit/react"
import { useQueryClient } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import { useFileContent, useFileTree } from "../hooks/useFile"

const HOVER_PREFETCH_DELAY = 100
const SidebarFile = memo((props: TFile) => {
  const { id: projectId } = useParams<{ id: string }>()
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const queryClient = useQueryClient()
  const { deleteFile, renameFile, isDeletingFile } = useFileTree()
  const { prefetchFileContent } = useFileContent({
    id: props.id,
  })
  const { ref, isDragging } = useDraggable({
    id: props.id,
    type: props.type,
    feedback: "clone",
  })

  const inputRef = useRef<HTMLInputElement>(null)
  const [imgSrc, setImgSrc] = useState(`/icons/${getIconForFile(props.name)}`)
  const [editing, setEditing] = useState(false)

  const hoverTimeout = useRef<NodeJS.Timeout | null>(null)

  const selectFile = async () => {
    const newTab = { ...props, saved: true }
    await queryClient.ensureQueryData(
      fileRouter.fileContent.getFetchOptions({
        projectId,
        fileId: props.id,
      })
    )
    setActiveTab(newTab)
  }
  const handleMouseEnter = () => {
    if (!editing && !isDeletingFile) {
      hoverTimeout.current = setTimeout(() => {
        prefetchFileContent()
      }, HOVER_PREFETCH_DELAY)
    }
  }

  const handleMouseLeave = () => {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current)
      hoverTimeout.current = null
    }
  }

  useEffect(() => {
    if (editing) {
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [editing, inputRef.current])

  const handleRename = () => {
    renameFile({
      fileId: props.id,
      projectId,
      newName: inputRef.current?.value ?? props.name,
    })
    setEditing(false)
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger
        ref={ref}
        disabled={isDeletingFile || isDragging}
        onClick={selectFile}
        onDoubleClick={() => {
          setEditing(true)
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        data-dragging={isDragging}
        className={
          "data-[dragging=true]:opacity-50 data-[dragging=true]:hover:!bg-background data-[state=open]:bg-secondary/50 w-full flex items-center h-7 px-1 hover:bg-secondary rounded-sm cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        }
      >
        <Image
          src={imgSrc}
          alt="File Icon"
          width={18}
          height={18}
          className="mr-2"
          onError={() => setImgSrc("/icons/default_file.svg")}
        />
        {isDeletingFile ? (
          <>
            <div className="text-muted-foreground animate-pulse">
              Deleting...
            </div>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleRename()
            }}
          >
            <input
              ref={inputRef}
              className={`bg-transparent transition-all focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-ring rounded-sm w-full ${
                editing ? "" : "pointer-events-none"
              }`}
              disabled={!editing}
              defaultValue={props.name}
              onBlur={() => handleRename()}
            />
          </form>
        )}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onClick={() => {
            setEditing(true)
          }}
        >
          <Pencil className="w-4 h-4 mr-2" />
          Rename
        </ContextMenuItem>
        <ContextMenuItem
          disabled={isDeletingFile}
          onClick={() => {
            deleteFile({
              fileId: props.id,
              projectId,
            })
          }}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
})

export default SidebarFile
