"use client"

import { githubRouter } from "@/lib/api"
import { cn } from "@/lib/utils"
import { FileEdit, FilePlus, FileX, Loader2 } from "lucide-react"
import { useParams } from "next/navigation"

interface ChangedFilesProps {
  className?: string
}

// Helper function to extract filename from path
const getFileName = (path: string): string => {
  return path.split("/").pop() || path
}

export function ChangedFiles({ className }: ChangedFilesProps) {
  const { id: projectId } = useParams<{ id: string }>()

  // Get repository status to determine if we should query changed files
  const { data: repoStatus } = githubRouter.repoStatus.useQuery({
    variables: { projectId },
    select(data) {
      return data?.data
    },
  })

  // Calculate if we have a repository
  const hasRepo = repoStatus
    ? repoStatus.existsInDB && repoStatus.existsInGitHub
    : false

  const {
    data: changedFilesData,
    isLoading,
    isFetching,
  } = githubRouter.getChangedFiles.useQuery({
    variables: { projectId },
    enabled: hasRepo && !!repoStatus?.existsInGitHub,
    staleTime: Infinity, // Don't refetch automatically - we'll manage this manually
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  const changedFiles = changedFilesData?.data

  if (isLoading) {
    return (
      <div className={cn("p-4", className)}>
        <div className="text-sm font-medium mb-2">Changed Files</div>
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (
    !changedFiles ||
    (!changedFiles.modified?.length &&
      !changedFiles.created?.length &&
      !changedFiles.deleted?.length)
  ) {
    return (
      <div className={cn("p-4", className)}>
        <div className="text-sm font-medium mb-2 flex items-center gap-2">
          Changed Files
          {isFetching && <Loader2 className="w-3 h-3 animate-spin" />}
        </div>
        <div className="text-sm text-muted-foreground">No changes detected</div>
      </div>
    )
  }

  const totalChanges =
    (changedFiles.modified?.length || 0) +
    (changedFiles.created?.length || 0) +
    (changedFiles.deleted?.length || 0)

  return (
    <div className={cn("p-4 border-b", className)}>
      <div className="text-sm font-medium mb-3 flex items-center gap-2">
        Changed Files ({totalChanges})
        {isFetching && <Loader2 className="w-3 h-3 animate-spin" />}
      </div>

      <div className="space-y-1 ">
        {/* Modified files */}
        {changedFiles.modified?.map((file: any) => (
          <div
            key={`modified-${file.path}`}
            className="flex items-center gap-2 text-sm py-1"
          >
            <FileEdit className="w-4 h-4 text-yellow-500 flex-shrink-0" />
            <span className="text-foreground truncate">
              {getFileName(file.path)}
            </span>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              (modified)
            </span>
          </div>
        ))}

        {/* Created files */}
        {changedFiles.created?.map((file: any) => (
          <div
            key={`created-${file.path}`}
            className="flex items-center gap-2 text-sm py-1"
          >
            <FilePlus className="w-4 h-4 text-green-500 flex-shrink-0" />
            <span className="text-foreground truncate">
              {getFileName(file.path)}
            </span>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              (created)
            </span>
          </div>
        ))}

        {/* Deleted files */}
        {changedFiles.deleted?.map((file: any) => (
          <div
            key={`deleted-${file.path}`}
            className="flex items-center gap-2 text-sm py-1"
          >
            <FileX className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="text-foreground truncate">
              {getFileName(file.path)}
            </span>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              (deleted)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
