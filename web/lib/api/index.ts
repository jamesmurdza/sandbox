import { apiClient } from "@/server/client"
import { inferFnData, router } from "react-query-kit"

// #region Github
export const githubRouter = router("github", {
  githubUser: router.query({
    fetcher: async () => {
      const res = await apiClient.github.user.$get()
      if (!res.ok) {
        return null
      }
      const data = await res.json()

      return data
    },
  }),
  login: router.mutation({
    mutationFn: async ({ code }: { code: string }) => {
      const res = await apiClient.github.login.$post({
        query: { code },
      })
      if (!res.ok) {
        throw new Error("Login failed")
      }
      const data = await res.json()
      return data
    },
  }),
  logout: router.mutation({
    mutationFn: async () => {
      const res = await apiClient.github.logout.$post()
      if (!res.ok) {
        throw new Error("Logout failed")
      }
      const data = await res.json()
      return data
    },
  }),
  gethAuthUrl: router.mutation({
    mutationFn: async () => {
      const res = await apiClient.github["auth_url"].$get()
      if (!res.ok) {
        throw new Error("Failed to get GitHub auth URL")
      }
      const data = await res.json()
      return data
    },
  }),
  createCommit: router.mutation({
    mutationFn: async ({
      projectId,
      message,
    }: {
      projectId: string
      message: string
    }) => {
      const res = await apiClient.github.repo.commit.$post({
        json: {
          projectId,
          message,
        },
      })
      const data = await res.json()
      if (!res.ok) {
        let errorMessage = "Failed to commit changes"
        if (
          typeof data.message === "string" &&
          typeof (data as any).data === "string"
        ) {
          const match = (data as any).data.match(/{.*}/)
          if (match) {
            try {
              const parsed = JSON.parse(match[0])
              if (parsed.message) {
                errorMessage += `: ${parsed.message}`
              }
            } catch (e) {
              // ignore JSON parse errors
            }
          }
        } else if (typeof data.message === "string") {
          errorMessage = data.message
        }
        throw new Error(errorMessage)
      }
      return data
    },
  }),
  createRepo: router.mutation({
    mutationFn: async ({ projectId }: { projectId: string }) => {
      const res = await apiClient.github.repo.create.$post({
        json: {
          projectId,
        },
      })
      const data = await res.json()
      if (!res.ok) {
        let errorMessage = "Failed to create repository"
        if (
          typeof data.message === "string" &&
          typeof (data as any).data === "string"
        ) {
          const match = (data as any).data.match(/{.*}/)
          if (match) {
            try {
              const parsed = JSON.parse(match[0])
              if (parsed.message) {
                errorMessage += `: ${parsed.message}`
              }
            } catch (e) {
              // ignore JSON parse errors
            }
          }
        } else if (typeof data.message === "string") {
          errorMessage = data.message
        }
        throw new Error(errorMessage)
      }
      return data
    },
  }),
  removeRepo: router.mutation({
    mutationFn: async ({ projectId }: { projectId: string }) => {
      const res = await apiClient.github.repo.remove.$delete({
        json: { projectId },
      })
      const data = await res.json()
      if (!res.ok) {
        let errorMessage = "Failed to delete repository"
        if (
          typeof data.message === "string" &&
          typeof (data as any).data === "string"
        ) {
          const match = (data as any).data.match(/{.*}/)
          if (match) {
            try {
              const parsed = JSON.parse(match[0])
              if (parsed.message) {
                errorMessage += `: ${parsed.message}`
              }
            } catch (e) {
              // ignore JSON parse errors
            }
          }
        } else if (typeof data.message === "string") {
          errorMessage = data.message
        }
        throw new Error(errorMessage)
      }
      return data
    },
  }),
  repoStatus: router.query({
    fetcher: async ({ projectId }: { projectId: string }) => {
      const res = await apiClient.github.repo.status.$get({
        query: { projectId },
      })
      if (!res.ok) {
        throw new Error("Failed to get repo status")
      }
      const data = await res.json()
      return data
    },
  }),
})

export type GithubUser = NonNullable<
  Awaited<ReturnType<typeof githubRouter.githubUser.fetcher>>
>["data"]

// #endregion

// #region File
const HEARTBEAT_POLL_INTERVERAL_MS = 10_000 // same as 10 seconds
export const fileRouter = router("file", {
  heartbeat: router.query({
    fetcher: async ({
      projectId,
      isOwner,
    }: {
      projectId: string
      isOwner: boolean
    }) => {
      const res = await apiClient.file.heartbeat.$post({
        json: { projectId, isOwner },
      })
      if (!res.ok) {
        throw new Error("Failed to fetch hearbeat")
      }
      const data = await res.json()
      return data
    },
    refetchInterval: HEARTBEAT_POLL_INTERVERAL_MS,
  }),
  fileContent: router.query({
    fetcher: async ({
      fileId,
      projectId,
    }: {
      fileId: string
      projectId: string
    }) => {
      const res = await apiClient.file.$get({
        query: { fileId, projectId },
      })
      if (!res.ok) {
        throw new Error("Failed to fetch file tree")
      }
      const data = await res.json()
      return data
    },
  }),
  saveFile: router.mutation({
    mutationFn: async (options: {
      fileId: string
      content: string
      projectId: string
    }) => {
      const res = await apiClient.file.save.$post({
        json: options,
      })
      if (!res.ok) {
        throw new Error("Failed to save file")
      }
      const data = await res.json()

      return data
    },
  }),
  createFile: router.mutation({
    mutationFn: async (options: { name: string; projectId: string }) => {
      const res = await apiClient.file.create.$post({
        json: options,
      })
      if (!res.ok) {
        throw new Error("Failed to create new file")
      }
      const data = await res.json()
      return data
    },
  }),
  createFolder: router.mutation({
    mutationFn: async (options: { name: string; projectId: string }) => {
      const res = await apiClient.file.folder.$post({
        json: options,
      })
      if (!res.ok) {
        throw new Error("Failed to create new folder")
      }
      const data = await res.json()
      return data
    },
  }),
  moveFile: router.mutation({
    mutationFn: async (options: {
      fileId: string
      folderId: string
      projectId: string
    }) => {
      const res = await apiClient.file.move.$post({
        json: options,
      })
      if (!res.ok) {
        throw new Error("Failed to create new file")
      }
      const data = await res.json()
      return data
    },
  }),
  fileTree: router.query({
    fetcher: async ({ projectId }: { projectId: string }) => {
      const res = await apiClient.file.tree.$get({
        query: { projectId },
      })
      if (!res.ok) {
        throw new Error("Failed to fetch file tree")
      }
      const data = await res.json()
      return data
    },
  }),
  deleteFile: router.mutation({
    mutationFn: async ({
      fileId,
      projectId,
    }: {
      fileId: string
      projectId: string
    }) => {
      const res = await apiClient.file.$delete({
        query: {
          fileId,
          projectId,
        },
      })
      if (!res.ok) {
        throw new Error("Failed to delete file")
      }
      return res.json()
    },
  }),
  deleteFolder: router.mutation({
    mutationFn: async ({
      folderId,
      projectId,
    }: {
      folderId: string
      projectId: string
    }) => {
      const res = await apiClient.file.folder.$delete({
        query: {
          folderId,
          projectId,
        },
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || "Failed to delete folder")
      }
      return res.json()
    },
  }),
  rename: router.mutation({
    mutationFn: async ({
      fileId,
      projectId,
      newName,
    }: {
      fileId: string
      projectId: string
      newName: string
    }) => {
      // Validate name
      const res = await apiClient.file.rename.$post({
        json: {
          fileId,
          projectId,
          newName,
        },
      })
      if (!res.ok) {
        const data = await res.json()

        throw new Error(data.message || "Failed to rename file")
      }
      return res.json()
    },
  }),
})

export type FileTree = NonNullable<
  inferFnData<typeof fileRouter.moveFile>["data"]
>

// #endregion
