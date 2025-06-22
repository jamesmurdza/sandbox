import { fileRouter } from "@/lib/api"
import { useQueryClient } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import * as React from "react"
import { toast } from "sonner"

export function useFileTree() {
  const { id: projectId } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const { data: fileTree = [] } = fileRouter.fileTree.useQuery({
    variables: {
      projectId,
    },
    select(data) {
      return data.data
    },
  })
  const { mutate: deleteFolder, isPending: isDeletingFolder } =
    fileRouter.deleteFolder.useMutation({
      onSuccess({ message }) {
        return queryClient
          .invalidateQueries(
            fileRouter.fileTree.getOptions({
              projectId,
            })
          )
          .then(() => {
            toast.success(message)
          })
      },
      onError() {
        toast.error("Couldn't delete folder")
      },
    })

  const { mutate: deleteFile, isPending: isDeletingFile } =
    fileRouter.deleteFile.useMutation({
      onSuccess({ message }) {
        return queryClient
          .invalidateQueries(
            fileRouter.fileTree.getOptions({
              projectId,
            })
          )
          .then(() => {
            toast.success(message)
          })
      },
      onError() {
        toast.error("Couldn't delete file")
      },
    })
  const { mutate: renameFile, isPending: isRenamingFile } =
    fileRouter.rename.useMutation({
      onSuccess({ message }, { newName }) {
        return queryClient
          .invalidateQueries(
            fileRouter.fileTree.getOptions({
              projectId,
            })
          )
          .then(() => {
            toast.success(message)
          })
      },
      onError() {
        toast.error("Couldn't delete file")
      },
    })

  return {
    fileTree,
    deleteFolder,
    deleteFile,
    renameFile,

    isDeletingFolder,
    isDeletingFile,
    isRenamingFile,
  }
}

export function useFileContent(
  { id: fileId, enabled = true } = { id: "", enabled: true }
) {
  const { id: projectId } = useParams<{ id: string }>()
  const queryClient = useQueryClient()

  const { data: fileContent, isLoading: isLoadingFileContent } =
    fileRouter.fileContent.useQuery({
      enabled: enabled ?? !!fileId,
      variables: {
        fileId,
        projectId,
      },
      select(data) {
        return data.data
      },
    })

  const prefetchFileContent = React.useCallback(async () => {
    await queryClient.prefetchQuery(
      fileRouter.fileContent.getFetchOptions({
        fileId,
        projectId,
      })
    )
  }, [fileId, projectId])

  return {
    fileContent,
    isLoadingFileContent,
    prefetchFileContent,
  }
}
