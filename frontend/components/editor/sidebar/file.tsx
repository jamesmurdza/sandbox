"use client"

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { TFile } from "@/lib/types"
import { Loader2, Pencil, Trash2 } from "lucide-react"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { getIconForFile } from "vscode-icons-js"

import { fileRouter } from "@/lib/api"
import { useAppStore } from "@/store/context"
import { draggable } from "@atlaskit/pragmatic-drag-and-drop/element/adapter"
import { useQueryClient } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import { useFileContent, useFileTree } from "../hooks/useFile"

const HOVER_PREFETCH_DELAY = 100
export default function SidebarFile({
  data,
  movingId,
}: {
  data: TFile
  movingId: string
}) {
  const { id: projectId } = useParams<{ id: string }>()
  const addTab = useAppStore((s) => s.addTab)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const isMoving = movingId === data.id
  const queryClient = useQueryClient()
  const { deleteFile, renameFile, isDeletingFile } = useFileTree()
  const { prefetchFileContent } = useFileContent({
    id: data.id,
  })
  const ref = useRef(null) // for draggable
  const [dragging, setDragging] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const [imgSrc, setImgSrc] = useState(`/icons/${getIconForFile(data.name)}`)
  const [editing, setEditing] = useState(false)

  const hoverTimeout = useRef<NodeJS.Timeout | null>(null)

  const selectFile = async () => {
    const newTab = { ...data, saved: true }
    addTab(newTab)
    await queryClient.ensureQueryData(
      fileRouter.fileContent.getFetchOptions({
        projectId,
        fileId: data.id,
      })
    )
    setActiveTab(newTab)
  }
  const handleMouseEnter = () => {
    if (!editing && !isDeletingFile && !isMoving) {
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
    const el = ref.current

    if (el)
      return draggable({
        element: el,
        onDragStart: () => setDragging(true),
        onDrop: () => setDragging(false),
        getInitialData: () => ({ id: data.id }),
      })
  }, [])

  useEffect(() => {
    if (editing) {
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [editing, inputRef.current])

  const handleRename = () => {
    renameFile({
      fileId: data.id,
      projectId,
      newName: inputRef.current?.value ?? data.name,
    })
    setEditing(false)
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger
        ref={ref}
        disabled={isDeletingFile || dragging || isMoving}
        onClick={selectFile}
        onDoubleClick={() => {
          setEditing(true)
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`${
          dragging ? "opacity-50 hover:!bg-background" : ""
        } data-[state=open]:bg-secondary/50 w-full flex items-center h-7 px-1 hover:bg-secondary rounded-sm cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring`}
      >
        <Image
          src={imgSrc}
          alt="File Icon"
          width={18}
          height={18}
          className="mr-2"
          onError={() => setImgSrc("/icons/default_file.svg")}
        />
        {isMoving ? (
          <>
            <Loader2 className="text-muted-foreground w-4 h-4 animate-spin mr-2" />
            <div className="text-muted-foreground">{data.name}</div>
          </>
        ) : isDeletingFile ? (
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
              defaultValue={data.name}
              onBlur={() => handleRename()}
            />
          </form>
        )}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onClick={() => {
            console.log("rename")
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
              fileId: data.id,
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
}
