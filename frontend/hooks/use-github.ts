import { useSocket } from "@/context/SocketContext"
import { createPopupTracker } from "@/lib/utils"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createQuery, Middleware, QueryHook } from "react-query-kit"
import { Socket } from "socket.io-client"
import { toast } from "sonner"

type GithubUser = any
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
    })
  }
}
export const useGithubUser = createQuery({
  queryKey: ["githubUser"],
  fetcher: (variable: { code?: string }, context) => {
    return new Promise<GithubUser>((resolve, reject) => {
      const ctx = context as typeof context & { socket: Socket }
      ctx.socket?.emit(
        "getGitHubUser",
        { code: variable.code },
        (data: any) => {
          console.log("data",data)
          if (data?.error) {
            reject(new Error(data.error))
            return
          }
          resolve(data)
        }
      )
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

interface CreateRepoResponse{ success:boolean;repoUrl:string;message:string }
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
          (response: CreateRepoResponse|{error:string}) => {
            if ("error" in response) {
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

export const useGithubLogout = () => {
  const { socket } = useSocket()
  const queryClient = useQueryClient()

  return useMutation({
    onSuccess: () => {
      queryClient.removeQueries({
        queryKey: useGithubUser.getKey(),
      })
      toast.success("Logged out of GitHub")
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
