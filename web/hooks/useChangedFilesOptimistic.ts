import { githubRouter } from "@/lib/api"
import { useQueryClient } from "@tanstack/react-query"
import { useParams } from "next/navigation"

interface ChangedFilesData {
  modified?: Array<{
    path: string
    localContent: string
    remoteContent: string
  }>
  created?: Array<{ path: string; content: string }>
  deleted?: Array<{ path: string }>
}

// Singleton to manage optimistic updates across all instances
class ChangedFilesOptimisticManager {
  private static instance: ChangedFilesOptimisticManager
  private queryClient: any
  private projectId: string | null = null

  private constructor() {}

  static getInstance(): ChangedFilesOptimisticManager {
    if (!ChangedFilesOptimisticManager.instance) {
      ChangedFilesOptimisticManager.instance =
        new ChangedFilesOptimisticManager()
    }
    return ChangedFilesOptimisticManager.instance
  }

  initialize(queryClient: any, projectId: string) {
    this.queryClient = queryClient
    this.projectId = projectId
  }

  private getChangedFilesKey() {
    if (!this.projectId) return null
    return githubRouter.getChangedFiles.getKey({ projectId: this.projectId })
  }

  // Helper function to normalize file paths (remove leading slash)
  private normalizePath(filePath: string): string {
    return filePath.startsWith("/") ? filePath.slice(1) : filePath
  }

  updateChangedFilesOptimistically(
    operation: "create" | "update" | "delete",
    filePath: string,
    content?: string
  ) {
    const queryKey = this.getChangedFilesKey()
    if (!queryKey || !this.queryClient) return

    const currentData = this.queryClient.getQueryData(queryKey) as
      | { data: ChangedFilesData }
      | undefined

    if (!currentData?.data) return

    const newData = { ...currentData.data }
    const normalizedPath = this.normalizePath(filePath)

    switch (operation) {
      case "create":
        // Check if file was previously deleted
        const deletedIndex = newData.deleted?.findIndex(
          (f) => this.normalizePath(f.path) === normalizedPath
        )
        if (deletedIndex !== undefined && deletedIndex >= 0) {
          // File was deleted and now recreated - treat as new file
          newData.deleted!.splice(deletedIndex, 1)
          if (!newData.created) newData.created = []
          newData.created.push({ path: normalizedPath, content: content || "" })
        } else {
          // Add to created files (new file)
          if (!newData.created) newData.created = []
          newData.created.push({ path: normalizedPath, content: content || "" })
        }

        // Ensure no duplicates exist across arrays
        newData.modified =
          newData.modified?.filter(
            (f) => this.normalizePath(f.path) !== normalizedPath
          ) || []
        newData.deleted =
          newData.deleted?.filter(
            (f) => this.normalizePath(f.path) !== normalizedPath
          ) || []
        break

      case "update":
        // Add to modified files or move from created to modified
        if (!newData.modified) newData.modified = []

        // Check if file was in created list
        const createdIndex = newData.created?.findIndex(
          (f) => this.normalizePath(f.path) === normalizedPath
        )
        if (createdIndex !== undefined && createdIndex >= 0) {
          //keep in created
        } else {
          // Check if file was previously deleted
          const deletedIndex = newData.deleted?.findIndex(
            (f) => this.normalizePath(f.path) === normalizedPath
          )
          if (deletedIndex !== undefined && deletedIndex >= 0) {
            // File was deleted and now modified - treat as new file
            newData.deleted!.splice(deletedIndex, 1)
            if (!newData.created) newData.created = []
            newData.created.push({
              path: normalizedPath,
              content: content || "",
            })
          } else {
            // Add to modified files (existing file modified)
            newData.modified.push({
              path: normalizedPath,
              localContent: content || "",
              remoteContent: "",
            })
          }
        }

        // Ensure no duplicates exist across arrays
        newData.created =
          newData.created?.filter(
            (f) => this.normalizePath(f.path) !== normalizedPath
          ) || []
        newData.deleted =
          newData.deleted?.filter(
            (f) => this.normalizePath(f.path) !== normalizedPath
          ) || []
        break

      case "delete":
        // Remove from created/modified and add to deleted
        if (!newData.deleted) newData.deleted = []

        // Remove from created
        if (newData.created) {
          newData.created = newData.created.filter(
            (f) => this.normalizePath(f.path) !== normalizedPath
          )
        }

        // Remove from modified
        if (newData.modified) {
          newData.modified = newData.modified.filter(
            (f) => this.normalizePath(f.path) !== normalizedPath
          )
        }

        // Add to deleted (only if not already there)
        const alreadyDeleted = newData.deleted.some(
          (f) => this.normalizePath(f.path) === normalizedPath
        )
        if (!alreadyDeleted) {
          newData.deleted.push({ path: normalizedPath })
        }

        // Ensure no duplicates exist across arrays
        newData.created =
          newData.created?.filter(
            (f) => this.normalizePath(f.path) !== normalizedPath
          ) || []
        newData.modified =
          newData.modified?.filter(
            (f) => this.normalizePath(f.path) !== normalizedPath
          ) || []
        break
    }

    // Update the cache optimistically
    this.queryClient.setQueryData(queryKey, { data: newData })
  }

  refreshChangedFiles() {
    const queryKey = this.getChangedFilesKey()
    if (!queryKey || !this.queryClient) return
    this.queryClient.invalidateQueries({ queryKey })
  }

  clearChangedFiles() {
    const queryKey = this.getChangedFilesKey()
    if (!queryKey || !this.queryClient) return
    this.queryClient.setQueryData(queryKey, {
      data: { modified: [], created: [], deleted: [] },
    })
  }
}

export function useChangedFilesOptimistic() {
  const { id: projectId } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const manager = ChangedFilesOptimisticManager.getInstance()

  // Initialize the manager with current context
  manager.initialize(queryClient, projectId)

  return {
    updateChangedFilesOptimistically:
      manager.updateChangedFilesOptimistically.bind(manager),
    refreshChangedFiles: manager.refreshChangedFiles.bind(manager),
    clearChangedFiles: manager.clearChangedFiles.bind(manager),
  }
}
