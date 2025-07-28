import { fileRouter, FileTree, githubRouter } from "@/lib/api"
import { sortFileExplorer } from "@/lib/utils"
import { useAppStore } from "@/store/context"
import { useQueryClient } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import * as React from "react"
import { toast } from "sonner"

export function useFileTree() {
  const { id: projectId } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const setTabs = useAppStore((s) => s.setTabs)

  const { data: fileTree = [], isLoading: isLoadingFileTree } =
    fileRouter.fileTree.useQuery({
      variables: {
        projectId,
      },
      select(data) {
        return sortFileExplorer(data.data ?? [])
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
            // Invalidate changed files query to refresh the list
            queryClient.invalidateQueries(
              githubRouter.getChangedFiles.getOptions({
                projectId,
              })
            )
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
            // Invalidate changed files query to refresh the list
            queryClient.invalidateQueries(
              githubRouter.getChangedFiles.getOptions({
                projectId,
              })
            )
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
            // Invalidate changed files query to refresh the list
            queryClient.invalidateQueries(
              githubRouter.getChangedFiles.getOptions({
                projectId,
              })
            )
            toast.success(message)
          })
      },
      onError() {
        toast.error("Couldn't delete file")
      },
    })

  const { mutateAsync: rawSaveFile } = fileRouter.saveFile.useMutation({
    onSuccess(_, { fileId }) {
      setTabs((tabs) =>
        tabs.map((tab) => (tab.id === fileId ? { ...tab, saved: true } : tab))
      )
      // Invalidate changed files query to refresh the list
      queryClient.invalidateQueries(
        githubRouter.getChangedFiles.getOptions({
          projectId,
        })
      )
    },
  })

  const fileTreeKey = fileRouter.fileTree.getKey({ projectId })
  const { mutate: moveFile } = fileRouter.moveFile.useMutation({
    onMutate: async (toBeMoved) => {
      await queryClient.cancelQueries(
        fileRouter.fileTree.getOptions({ projectId })
      )

      const previous = queryClient.getQueryData(fileTreeKey)

      // Optimistically update to the new value
      if (previous?.data) {
        const newTree = structuredClone(previous.data)

        const movedNode = removeNode(newTree, toBeMoved.fileId)
        if (movedNode) {
          const rebased = rebaseNodeIds(movedNode, toBeMoved.folderId)
          // TODO: Further optimiztion: move queryCache value of file content to newId; move draft to new Id; account for if it's a activeTab;
          insertNode(newTree, toBeMoved.folderId, rebased)
        }

        queryClient.setQueryData(fileTreeKey, (old) =>
          old
            ? {
                ...old,
                data: newTree,
              }
            : old
        )
      }

      return { previous }
    },

    onError: (_err, _variables, context) => {
      // Roll back to the previous tree
      if (context?.previous) {
        queryClient.setQueryData(fileTreeKey, context.previous)
      }
      toast.error("Failed to move file")
    },

    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries(
        fileRouter.fileTree.getOptions({ projectId })
      )
      // Invalidate changed files query to refresh the list
      queryClient.invalidateQueries(
        githubRouter.getChangedFiles.getOptions({
          projectId,
        })
      )
    },
  })

  function saveFile(...args: Parameters<typeof rawSaveFile>) {
    toast.promise(rawSaveFile(...args), {
      loading: "Saving...",
      success: (data) => {
        return data.message
      },
      error: "Error saving file",
    })
  }
  return {
    fileTree,
    deleteFolder,
    deleteFile,
    renameFile,
    saveFile,
    moveFile,

    isLoadingFileTree,
    isDeletingFolder,
    isDeletingFile,
    isRenamingFile,
  }
}

export function useFileContent(
  {
    id: fileId,
    enabled = true,
  }: {
    id: string
    enabled?: boolean
  } = { id: "", enabled: true }
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

// Helper: remove a node by path, returning the removed node
function removeNode(
  nodes: FileTree,
  targetPath: string
): FileTree[number] | null {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (node.id === targetPath) {
      return nodes.splice(i, 1)[0]
    }
    if (node.type === "folder") {
      const removed = removeNode(node.children, targetPath)
      if (removed) return removed
    }
  }
  return null
}
// Recursively update a node’s id (and its subtree) to live under `newParentPath`
function rebaseNodeIds<
  N extends {
    id: string
    name: string
    type: "file" | "folder"
    children?: any
  }
>(node: N, newParentPath: string): N {
  const parent = newParentPath === "/" ? "" : newParentPath.replace(/\/$/, "")

  const newId = `${parent}/${node.name}`

  if (node.type === "folder" && Array.isArray(node.children)) {
    return {
      ...node,
      id: newId,
      children: node.children.map((child) => rebaseNodeIds(child, newId)),
    } as N
  }

  return {
    ...node,
    id: newId,
  } as N
}

// Helper: insert a node into a folder (or root if folderPath is empty)
function insertNode(
  nodes: FileTree,
  folderPath: string,
  nodeToInsert: FileTree[number]
): boolean {
  if (folderPath === "/") {
    nodes.push(nodeToInsert)
    return true
  }

  for (const node of nodes) {
    if (node.type === "folder") {
      if (node.id === folderPath) {
        node.children.push(nodeToInsert)
        return true
      }
      // Recurse into subfolders
      if (insertNode(node.children, folderPath, nodeToInsert)) {
        return true
      }
    }
  }

  return false
}
