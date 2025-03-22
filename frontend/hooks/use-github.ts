import { useSocket } from "@/context/SocketContext"
import { createPopupTracker } from "@/lib/utils"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createQuery, Middleware, QueryHook } from "react-query-kit"
import { Socket } from "socket.io-client"
import { toast } from "sonner"

export type GithubUser = {
  name: string
  avatar_url: string
  login: string
  html_url: string
  // ...the rest
}
const socketMiddleware: Middleware<QueryHook<any, any>> = (useQueryNext) => {
  return (options) => {
    const { socket } = useSocket()
    const fetcher = (variables: unknown, context: any) => {
      context.socket = socket
      return options.fetcher(variables, context)
    }

    return useQueryNext({
      ...options,
      fetcher,
      queryKey: [...options.queryKey, socket?.connected],
      enabled: Boolean(socket?.connected),
    })
  }
}
export const useGithubUser = createQuery({
  queryKey: ["githubUser"],
  retry: 0,
  fetcher: (variable: { code?: string }, context) => {
    return new Promise<GithubUser | null>((resolve, reject) => {
      const ctx = context as typeof context & { socket: Socket }
      if (!ctx.socket?.connected) {
        reject(new Error("Socket not connected"))
        return
      }

      ctx.socket.emit("getGitHubUser", { code: variable.code }, (data: any) => {
        if (data?.error) {
          resolve(null)
          return
        }

        // Explicitly handle null response
        if (data === null) {
          resolve(null)
          return
        }

        resolve(data)
      })
    })
  },
  use: [socketMiddleware],
})

const REDIRECT_URI = "/loading"

export const useGithubLogin = ({
  onSuccess,
}: {
  onSuccess?: (data: { code: string }) => void
}) => {
  const { socket } = useSocket()
  const queryClient = useQueryClient()

  return useMutation({
    onSuccess,
    mutationFn: async () => {
      const tracker = createPopupTracker()

      return new Promise<{ code: string }>((resolve, reject) => {
        if (!socket?.connected) {
          reject(new Error("Socket not connected"))
          return
        }

        socket.emit(
          "authenticateGithub",
          {},
          (response: { authUrl: string }) => {
            if (!response.authUrl) {
              reject(new Error("No auth URL received"))
              return
            }

            tracker.openPopup(response.authUrl, {
              onUrlChange(newUrl) {
                if (newUrl.includes(REDIRECT_URI)) {
                  const urlParams = new URLSearchParams(new URL(newUrl).search)
                  const code = urlParams.get("code")
                  tracker.closePopup()

                  if (code) {
                    resolve({ code })
                  } else {
                    reject(new Error("No code received"))
                  }
                }
              },
              onClose() {
                reject(new Error("Authentication window closed"))
              },
            })
          }
        )
      })
    },
  })
}

interface CreateRepoResponse {
  success: boolean
  repoUrl: string
  message: string
}
export const useCreateRepo = ({
  onSuccess,
}: {
  onSuccess?: (data: CreateRepoResponse) => void
}) => {
  const { socket } = useSocket()

  return useMutation({
    onSuccess,
    mutationFn: async () => {
      return new Promise<CreateRepoResponse>((resolve, reject) => {
        if (!socket?.connected) {
          reject(new Error("Socket not connected"))
          return
        }

        socket.emit(
          "createRepo",
          {},
          (response: CreateRepoResponse | { error: string }) => {
            if ("error" in response) {
              toast.error(response.error)
              reject(new Error("No auth URL received"))
              return
            }
            resolve(response)
          }
        )
      })
    },
  })
}
interface CreateCommitResponse {
  success: boolean
  repoUrl: string
}
export const useCreateCommit = ({
  onSuccess,
}: {
  onSuccess?: (data: CreateCommitResponse) => void
}) => {
  const { socket } = useSocket()

  return useMutation({
    onSuccess,
    mutationFn: async (data: {
      repoId: string
      message: string
      repoName: string
    }) => {
      return new Promise<CreateCommitResponse>((resolve, reject) => {
        if (!socket?.connected) {
          reject(new Error("Socket not connected"))
          return
        }

        socket.emit(
          "createCommit",
          data,
          (response: CreateCommitResponse | { error: string }) => {
            if ("error" in response) {
              toast.error(response.error)
              reject(new Error("No auth URL received"))
              return
            }
            resolve(response)
          }
        )
      })
    },
  })
}
interface DeleteRepoResponse {
  success: true
}
export const useDeleteRepo = ({
  onSuccess,
}: {
  onSuccess?: (data: DeleteRepoResponse) => void
}) => {
  const { socket } = useSocket()

  return useMutation({
    onSuccess,
    mutationFn: async (data: { repoId: string }) => {
      return new Promise<DeleteRepoResponse>((resolve, reject) => {
        if (!socket?.connected) {
          reject(new Error("Socket not connected"))
          return
        }

        socket.emit(
          "deleteRepodIdFromDB",
          data,
          (response: DeleteRepoResponse | { error: string }) => {
            if ("error" in response) {
              toast.error(response.error)
              reject(new Error("No auth URL received"))
              return
            }
            resolve(response)
          }
        )
      })
    },
  })
}

interface CheckSandboxRepoResponse {
  existsInDB: boolean
  existsInGitHub: boolean
  repo?: {
    id: string
    name: string
  }
}

export const useCheckSandboxRepo = createQuery({
  queryKey: ["CheckSandboxRepo"],
  fetcher: async (_variable: {}, context) => {
    const { socket } = context as typeof context & { socket?: Socket }
    console.log("Query function executed, socket state:", {
      connected: socket?.connected,
      id: socket?.id,
    })

    return new Promise<CheckSandboxRepoResponse>((resolve, reject) => {
      console.log("Setting up promise for socket emit")

      if (!socket) {
        console.error("Socket is null or undefined")
        reject(new Error("Socket not available"))
        return
      }

      if (!socket.connected) {
        console.error("Socket exists but not connected")
        reject(new Error("Socket not connected"))
        return
      }

      console.log("About to emit checkSandboxRepo event")

      // Create a timeout that we can clear if successful
      const timeoutId = setTimeout(() => {
        console.error("No response received after 5 seconds")
        reject(new Error("Socket timeout"))
      }, 5000)

      socket.emit(
        "checkSandboxRepo",
        {},
        (response: CheckSandboxRepoResponse | { error: string }) => {
          // Clear the timeout since we got a response
          clearTimeout(timeoutId)

          console.log("Received response from checkSandboxRepo:", response)
          if ("error" in response) {
            toast.error(response.error)
            reject(new Error("No auth URL received"))
            return
          }
          resolve(response)
        }
      )
    })
  },
  use: [socketMiddleware],
})

export const useGithubLogout = ({ onSuccess }: { onSuccess: () => void }) => {
  const { socket } = useSocket()
  const queryClient = useQueryClient()
  return useMutation({
    onSuccess: () => {
      onSuccess()
      queryClient.setQueryData(["githubUser"], () => undefined)
    },
    mutationFn: async () => {
      return new Promise<{ success: boolean }>((resolve, reject) => {
        if (!socket?.connected) {
          reject(new Error("Socket not connected"))
          return
        }

        socket.emit(
          "logoutGithubUser",
          {},
          (response: { success: boolean; error?: string }) => {
            if (response.error) {
              reject(new Error(response.error))
            }
            resolve(response)
          }
        )
      })
    },
  })
}
