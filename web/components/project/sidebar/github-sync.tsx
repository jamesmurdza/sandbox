"use client"

import Avatar from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { githubRouter, type GithubUser } from "@/lib/api"
import { cn, createPopupTracker } from "@/lib/utils"
import { useQueryClient } from "@tanstack/react-query"
import {
  GitBranch,
  GithubIcon,
  Loader2,
  MoreVertical,
  PackagePlus,
  RefreshCw,
} from "lucide-react"
import { useParams } from "next/navigation"
import * as React from "react"
import { toast } from "sonner"

const REDIRECT_URI = "/loading"

export function GitHubSync({ userId }: { userId: string }) {
  const { id: projectId } = useParams<{ id: string }>()
  const [commitMessage, setCommitMessage] = React.useState("")
  const queryClient = useQueryClient()
  const {
    mutate: handleGithubLogin,
    isPending: isLoggingIn,
    reset: resetGithubLogin,
  } = githubRouter.login.useMutation({
    onSuccess: () => {
      return queryClient.invalidateQueries(githubRouter.githubUser.getOptions())
    },
    onError: () => {
      toast.error("GitHub login failed")
    },
  })
  const { mutate: getAuthUrl, isPending: isGettingAuthUrl } =
    githubRouter.gethAuthUrl.useMutation({
      onSuccess({ data: { auth_url } }) {
        const tracker = createPopupTracker()

        return new Promise<{ code: string }>((resolve, reject) => {
          tracker.openPopup(auth_url, {
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
        })
          .then(({ code }) => {
            handleGithubLogin({ code })
          })
          .catch((error) => {
            toast.error(
              error instanceof Error ? error.message : "Authentication failed"
            )
          })
      },
      onError: () => {
        toast.error("Failed to get GitHub authorization URL")
      },
    })
  const { data: githubUser } = githubRouter.githubUser.useQuery({
    select(data) {
      return data?.data
    },
  })
  const { data: repoStatus } = githubRouter.repoStatus.useQuery({
    variables: {
      projectId: projectId,
    },
    select(data) {
      return data.data
    },
  })
  const { mutate: syncToGithub, isPending: isSyncingToGithub } =
    githubRouter.createCommit.useMutation({
      onSuccess() {
        setCommitMessage("")
        toast.success("Commit created successfully")
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to commit changes")
      },
    })
  const { mutate: deleteRepo, isPending: isDeletingRepo } =
    githubRouter.removeRepo.useMutation({
      onSuccess() {
        return queryClient
          .invalidateQueries(
            githubRouter.repoStatus.getOptions({
              projectId: projectId,
            })
          )
          .then(() => {
            setCommitMessage("")
            toast.success("Repository deleted successfully")
          })
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to delete repository")
      },
    })
  const hasRepo = repoStatus
    ? repoStatus.existsInDB && repoStatus.existsInGitHub
    : false
  const { mutate: handleCreateRepo, isPending: isCreatingRepo } =
    githubRouter.createRepo.useMutation({
      onSuccess() {
        return queryClient
          .invalidateQueries(
            githubRouter.repoStatus.getOptions({
              projectId: projectId,
            })
          )
          .then(() => {
            toast.success("Repository created successfully")
          })
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to create repository")
      },
    })

  const content = React.useMemo(() => {
    if (!githubUser) {
      return (
        <>
          <p className="text-xs">
            your project with GitHub™️ to keep your code safe, secure, and
            easily accessible from anywhere.
          </p>

          <Button
            variant="secondary"
            size="xs"
            className="mt-4 w-full font-normal"
            onClick={() => getAuthUrl()}
            disabled={isGettingAuthUrl || isLoggingIn}
          >
            {isLoggingIn ? (
              <Loader2 className="animate-spin mr-2 size-3" />
            ) : (
              <GithubIcon className="size-3 mr-2" />
            )}
            Connect to GitHub
          </Button>
        </>
      )
    } else {
      if (hasRepo) {
        return (
          <>
            <p className="text-xs">
              Connect your project to GitHub to ensure your code is secure,
              backed up, and accessible from any location.
            </p>
            <div className="flex items-center justify-between bg-muted/50 px-2 py-1 rounded-sm">
              <div className="flex items-center gap-2">
                <GithubUserButton {...githubUser} />
                <div>
                  <a
                    href={`${githubUser.html_url}/${repoStatus?.repo?.name}`}
                    className="text-xs font-medium hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {repoStatus?.repo?.name}
                  </a>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <GitBranch className="size-2.5" />
                    <span className="text-[0.65rem]">main</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="smIcon" className="size-6">
                      <MoreVertical className="size-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="">
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault()
                        deleteRepo({
                          projectId: projectId,
                        })
                      }}
                    >
                      {isDeletingRepo && (
                        <Loader2 className="animate-spin mr-2 size-3" />
                      )}
                      Delete Repository
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              <Textarea
                placeholder="Add a commit message here..."
                className="!text-xs ring-inset"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
              />
              <Button
                variant="secondary"
                size="xs"
                className="w-full font-normal"
                onClick={() =>
                  syncToGithub({
                    projectId: projectId,
                    message: commitMessage,
                  })
                }
              >
                {isSyncingToGithub ? (
                  <Loader2 className="animate-spin mr-2 size-3" />
                ) : (
                  <RefreshCw className="size-3 mr-2" />
                )}
                Sync code
              </Button>
            </div>
          </>
        )
      } else {
        return (
          <>
            <p className="text-xs">
              your don't have a Github repository linked to this sandbox yet.
              You can create one to sync your code with GitHub.
            </p>
            <div className="flex gap-1 mt-4">
              <GithubUserButton {...githubUser} rounded="sm" />
              <Button
                variant="secondary"
                size="xs"
                className="w-full font-normal"
                onClick={() => {
                  handleCreateRepo({
                    projectId: projectId,
                  })
                }}
                disabled={isCreatingRepo}
              >
                {isCreatingRepo ? (
                  <Loader2 className="animate-spin mr-2 size-3" />
                ) : (
                  <PackagePlus className="size-3 mr-2" />
                )}
                Create Repo
              </Button>
            </div>
          </>
        )
      }
    }
  }, [
    githubUser,
    isLoggingIn,
    hasRepo,
    isCreatingRepo,
    commitMessage,
    isSyncingToGithub,
    isDeletingRepo,
    handleGithubLogin,
    repoStatus,
    handleCreateRepo,
    syncToGithub,
    deleteRepo,
    getAuthUrl,
  ])

  React.useEffect(() => {
    if (githubUser) {
      resetGithubLogin()
    }
  }, [githubUser, resetGithubLogin])

  return (
    <ScrollArea className="flex-grow overflow-auto px-2 pt-0 pb-4 relative">
      <div className="flex flex-col gap-3 w-full pt-2">
        <div className="flex items-center justify-between w-full">
          <h2 className="font-medium">Sync to GitHub</h2>
        </div>
        {content}
      </div>
    </ScrollArea>
  )
}

interface GithubUserButtonProps {
  rounded?: "full" | "sm"
}

function GithubUserButton({
  rounded,
  ...githubUser
}: GithubUserButtonProps & GithubUser) {
  const queryClient = useQueryClient()
  const { mutate: handleGithubLogout, isPending: isLoggingOut } =
    githubRouter.logout.useMutation({
      onSuccess: () => {
        return queryClient.invalidateQueries(
          githubRouter.githubUser.getOptions()
        )
      },
      onError: () => {
        toast.error("Failed to logout from GitHub")
      },
    })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="smIcon" className="size-6">
          <Avatar
            className={cn("size-6", rounded === "sm" && "rounded-sm")}
            name={githubUser.name ?? ""}
            avatarUrl={githubUser.avatar_url}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" side="bottom" align="start">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Avatar
              className="size-6"
              name={githubUser.name ?? ""}
              avatarUrl={githubUser.avatar_url}
            />
            <div className="grid flex-1 text-left text-sm leading-tight ml-2">
              <span className="truncate font-semibold text-xs">
                {githubUser.name}
              </span>
              <span className="truncate text-[0.6rem]">
                @{githubUser.login}
              </span>
            </div>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  handleGithubLogout()
                }}
              >
                {isLoggingOut && (
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                )}
                Logout
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={githubUser.html_url} target="_blank" rel="noreferrer">
                  View profile
                </a>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
