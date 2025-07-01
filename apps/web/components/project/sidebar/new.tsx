"use client"

import { fileRouter } from "@/lib/api"
import { validateName } from "@/lib/utils"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import Image from "next/image"
import { useState } from "react"
import { toast } from "sonner"
import {
  DEFAULT_FILE,
  DEFAULT_FOLDER,
  getIconForFile,
  getIconForFolder,
} from "vscode-icons-js"

export default function New({
  projectId,
  type,
  stopEditing,
}: {
  projectId: string
  type: "file" | "folder"
  stopEditing: () => void
}) {
  const [value, setValue] = useState("")
  const queryClient = useQueryClient()
  const { mutate: createFile, isPending: isCreatingFile } =
    fileRouter.createFile.useMutation({
      onSuccess() {
        return queryClient
          .invalidateQueries(
            fileRouter.fileTree.getOptions({
              projectId,
            })
          )
          .then(() => {
            stopEditing()
          })
      },
      onError() {
        toast.error("Failed to create file")
      },
    })
  const { mutate: createFolder, isPending: isCreatingFolder } =
    fileRouter.createFolder.useMutation({
      onSuccess() {
        return queryClient
          .invalidateQueries(
            fileRouter.fileTree.getOptions({
              projectId,
            })
          )
          .then(() => {
            stopEditing()
          })
      },
      onError() {
        toast.error("Failed to create folder")
      },
    })
  const isPending = isCreatingFile || isCreatingFolder
  const icon =
    type == "file"
      ? getIconForFile(value) ?? DEFAULT_FILE
      : getIconForFolder(value) ?? DEFAULT_FOLDER

  function createNew() {
    const name = value
    if (!name || !validateName(name, "", type).status) {
      toast.info("Use a valid file name")
      stopEditing()
      return
    }
    const createItem = type == "file" ? createFile : createFolder
    createItem({
      name,
      projectId,
    })
  }

  return (
    <div className="w-full flex items-center gap-2 h-7 px-1 hover:bg-secondary rounded-sm cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
      {isPending ? (
        <Loader2 className="animate-spin size-[1.125rem]" />
      ) : (
        <Image src={`/icons/${icon}`} alt="File Icon" width={18} height={18} />
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          createNew()
        }}
      >
        <input
          value={value}
          onChange={(e) => setValue(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              stopEditing()
            }
          }}
          className="bg-transparent transition-all focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-ring rounded-sm w-full"
          autoFocus
          disabled={isPending}
          onBlur={createNew}
        />
      </form>
    </div>
  )
}
