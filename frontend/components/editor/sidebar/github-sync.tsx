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
import {
  useCheckSandboxRepo,
  useCreateCommit,
  useCreateRepo,
  useDeleteRepo,
  useGithubLogin,
  useGithubLogout,
  useGithubUser,
  type GithubUser,
} from "@/hooks/use-github"
import { cn } from "@/lib/utils"
import {
  GitBranch,
  GithubIcon,
  Loader2,
  MoreVertical,
  PackagePlus,
  RefreshCw,
} from "lucide-react"
import * as React from "react"
import { toast } from "sonner"

export function GitHubSync() {
  const [commitMessage, setCommitMessage] = React.useState("")
  const {
    mutate: handleGithubLogin,
    isPending: isLoggingIn,
    data: githubLoginDetails,
    reset: resetGithubLogin,
  } = useGithubLogin({
    onSuccess: () => {
      refetchGithubUser()
    },
  })
  const { data: githubUser, refetch: refetchGithubUser } = useGithubUser({
    variables: {
      code: githubLoginDetails?.code,
    },
  })
  const { data: repoStatus, refetch: refetchCheckSandboxRepo } =
    useCheckSandboxRepo()
  const { mutate: syncToGithub, isPending: isSyncingToGithub } =
    useCreateCommit({
      onSuccess() {
        setCommitMessage("")
        toast.success("Commit created successfully")
      },
    })
  const { mutate: deleteRepo, isPending: isDeletingRepo } = useDeleteRepo({
    onSuccess() {
      setCommitMessage("")
      toast.success("Repository deleted successfully")
      refetchCheckSandboxRepo()
    },
  })
  const hasRepo = repoStatus
    ? repoStatus.existsInDB && repoStatus.existsInGitHub
    : false
  const { mutate: handleCreateRepo, isPending: isCreatingRepo } = useCreateRepo(
    {
      onSuccess() {
        toast.success("Repository created successfully")
        refetchCheckSandboxRepo()
      },
    }
  )

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
            onClick={() => handleGithubLogin()}
            disabled={isLoggingIn}
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
                <GithubUserButton
                  onLogout={() => {
                    refetchGithubUser()
                  }}
                  {...githubUser}
                />
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
                          repoId: repoStatus?.repo?.id ?? "",
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
                    repoId: repoStatus?.repo?.id!,
                    repoName: repoStatus?.repo?.name!,
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
              <GithubUserButton
                onLogout={() => {
                  refetchGithubUser()
                }}
                {...githubUser}
                rounded="sm"
              />
              <Button
                variant="secondary"
                size="xs"
                className="w-full font-normal"
                onClick={() => {
                  handleCreateRepo()
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
    refetchGithubUser,
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

interface GithubUserButtonProps extends GithubUser {
  rounded?: "full" | "sm"
  onLogout: () => void
}

function GithubUserButton({
  rounded,
  onLogout,
  ...githubUser
}: GithubUserButtonProps) {
  const { mutate: handleGithubLogout, isPending: isLoggingOut } =
    useGithubLogout({
      onSuccess: onLogout,
    })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="smIcon" className="size-6">
          <Avatar
            className={cn("size-6", rounded === "sm" && "rounded-sm")}
            name={githubUser.name}
            avatarUrl={githubUser.avatar_url}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" side="bottom" align="start">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Avatar
              className="size-6"
              name={githubUser.name}
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
