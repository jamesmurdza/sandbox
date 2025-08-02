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

// Manager to handle optimistic updates for changed files
class ChangedFilesOptimisticManager {
  private static instances = new Map<string, ChangedFilesOptimisticManager>()
  private queryClient: any
  private projectId: string | null = null

  private constructor() {}

  static getInstance(projectId: string): ChangedFilesOptimisticManager {
    if (!ChangedFilesOptimisticManager.instances.has(projectId)) {
      ChangedFilesOptimisticManager.instances.set(
        projectId,
        new ChangedFilesOptimisticManager()
      )
    }
    return ChangedFilesOptimisticManager.instances.get(projectId)!
  }

  initialize(queryClient: any, projectId: string) {
    this.queryClient = queryClient
    this.projectId = projectId
  }

  private getChangedFilesKey() {
    if (!this.projectId) return null
    return githubRouter.getChangedFiles.getKey({ projectId: this.projectId })
  }

  // Helper function to normalize file paths (ensure consistent format)
  private normalizePath(filePath: string): string {
    // Remove leading slash and ensure consistent format
    return filePath.replace(/^\/+/, "")
  }

  updateChangedFilesOptimistically(
    operation: "create" | "update" | "delete",
    filePath: string,
    content?: string
  ) {
    const queryKey = this.getChangedFilesKey()
    if (!queryKey || !this.queryClient) {
      console.warn(
        "Cannot update changed files: missing query key or query client"
      )
      return
    }

    const currentData = this.queryClient.getQueryData(queryKey) as
      | { data: ChangedFilesData }
      | undefined

    if (!currentData?.data) {
      console.warn("Cannot update changed files: no current data available")
      return
    }

    const newData = { ...currentData.data }
    const normalizedPath = this.normalizePath(filePath)

    switch (operation) {
      case "create":
        // Check if file was previously deleted
        const deletedIndex = newData.deleted?.findIndex(
          (f) => this.normalizePath(f.path) === normalizedPath
        )
        if (deletedIndex !== undefined && deletedIndex !== -1) {
          // File was deleted and now recreated - treat as new file
          newData.deleted!.splice(deletedIndex, 1)
          if (!newData.created) newData.created = []
          newData.created.push({ path: normalizedPath, content: content || "" })
        } else {
          // Add to created files (new file)
          if (!newData.created) newData.created = []

          // Add to deleted (only if not already there)
          const alreadyCreated = newData.created.some(
            (f) => this.normalizePath(f.path) === normalizedPath
          )
          if (!alreadyCreated) {
            newData.created.push({
              path: normalizedPath,
              content: content || "",
            })
          }
        }

        break

      case "update":
        // Add to modified files or move from created to modified
        if (!newData.modified) newData.modified = []

        // Check if file was in created list
        const createdIndex = newData.created?.findIndex(
          (f) => this.normalizePath(f.path) === normalizedPath
        )

        if (createdIndex !== undefined && createdIndex !== -1) {
          // File is in created list - keep it there, just update content
          newData.created![createdIndex].content = content || ""
        } else {
          // Check if file was previously deleted
          const deletedIndex = newData.deleted?.findIndex(
            (f) => this.normalizePath(f.path) === normalizedPath
          )
          if (deletedIndex !== undefined && deletedIndex !== -1) {
            // File was deleted and now modified
            newData.deleted!.splice(deletedIndex, 1)
            if (!newData.modified) newData.modified = []
            newData.modified.push({
              path: normalizedPath,
              localContent: content || "",
              remoteContent: "",
            })
          } else {
            // Add to modified files (existing file modified)
            if (!newData.modified) newData.modified = []
            const alreadyModified = newData.modified.some(
              (f) => this.normalizePath(f.path) === normalizedPath
            )
            if (!alreadyModified) {
              newData.modified.push({
                path: normalizedPath,
                localContent: content || "",
                remoteContent: "",
              })
            }
          }
        }
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

        break
    }

    // Update the cache optimistically
    this.queryClient.setQueryData(queryKey, { data: newData })
  }

  refreshChangedFiles() {
    const queryKey = this.getChangedFilesKey()
    if (!queryKey || !this.queryClient) {
      console.warn(
        "Cannot refresh changed files: missing query key or query client"
      )
      return
    }
    this.queryClient.invalidateQueries({ queryKey })
  }

  clearChangedFiles() {
    const queryKey = this.getChangedFilesKey()
    if (!queryKey || !this.queryClient) {
      console.warn(
        "Cannot clear changed files: missing query key or query client"
      )
      return
    }
    this.queryClient.setQueryData(queryKey, {
      data: { modified: [], created: [], deleted: [] },
    })
  }
}

export function useChangedFilesOptimistic() {
  const { id: projectId } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const manager = ChangedFilesOptimisticManager.getInstance(projectId)

  // Initialize the manager with current context
  manager.initialize(queryClient, projectId)

  return {
    updateChangedFilesOptimistically:
      manager.updateChangedFilesOptimistically.bind(manager),
    refreshChangedFiles: manager.refreshChangedFiles.bind(manager),
    clearChangedFiles: manager.clearChangedFiles.bind(manager),
  }
}
