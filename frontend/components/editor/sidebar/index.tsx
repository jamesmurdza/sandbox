"use client"
import { File, Github } from "@/components/ui/Icons"
import Avatar from "@/components/ui/avatar"
import { Button, buttonVariants } from "@/components/ui/button"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  useCheckSandboxRepo,
  useCreateCommit,
  useCreateRepo,
  useDeleteRepo,
  useGithubLogin,
  useGithubLogout,
  useGithubUser,
} from "@/hooks/use-github"
import { Sandbox, TFile, TFolder, TTab } from "@/lib/types"
import { cn, sortFileExplorer } from "@/lib/utils"
import {
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter"
import { Slot } from "@radix-ui/react-slot"
import { useQueryClient } from "@tanstack/react-query"
import { VariantProps } from "class-variance-authority"
import { AnimatePresence, motion } from "framer-motion"
import {
  FilePlus,
  FolderPlus,
  GitBranch,
  Loader2,
  MessageSquareMore,
  MoreVertical,
  PackagePlus,
  RefreshCw,
  Sparkles,
} from "lucide-react"
import * as React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Socket } from "socket.io-client"
import { toast } from "sonner"
import SidebarFile from "./file"
import SidebarFolder from "./folder"
import New from "./new"

const sidebarItem = [
  {
    id: "file",
    name: "File Explorer",
    icon: File,
  },
  {
    id: "github",
    name: "Sync to GitHub",
    icon: Github,
  },
]
// #region Sidebar
interface SidebarProps extends FileManagerProps {}
export default function Sidebar(props: SidebarProps) {
  const [activeItem, setActiveItem] = useState<string | null>(sidebarItem[0].id)
  const hideSidebar = activeItem === null
  // prefetch queries
  useCheckSandboxRepo()
  useGithubUser()
  return (
    <TooltipProvider>
      <div className="flex h-full">
        <div className="w-12 flex flex-col items-center gap-3 pt-2 border-r border-secondary">
          {sidebarItem.map(({ id, name, icon: Icon }, index) => (
            <SidebarButton
              key={index}
              isActive={activeItem === id}
              onClick={() => setActiveItem(activeItem === id ? null : id)}
              variant="ghost"
              size="smIcon"
              tooltip={name}
            >
              <Icon className="size-5" />
            </SidebarButton>
          ))}
        </div>
        <motion.div
          className={cn(
            "h-full w-56 transition-all duration-300 delay-75",
            hideSidebar ? "w-0" : "w-56"
          )}
        >
          <AnimatePresence initial={false} mode="wait">
            {activeItem === "file" && <FileExplorer {...props} />}
            {activeItem === "github" && (
              <GitHubSync repoId={props.sandboxData?.repositoryId} />
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </TooltipProvider>
  )
}
// #endregion

// #region File Explorer
interface FileManagerProps {
  sandboxData: Sandbox
  files: (TFile | TFolder)[]
  selectFile: (tab: TTab) => void
  handleRename: (
    id: string,
    newName: string,
    oldName: string,
    type: "file" | "folder"
  ) => boolean
  handleDeleteFile: (file: TFile) => void
  handleDeleteFolder: (folder: TFolder) => void
  socket: Socket
  setFiles: (files: (TFile | TFolder)[]) => void
  deletingFolderId: string
  toggleAIChat: () => void
  isAIChatOpen: boolean
}
function FileExplorer({
  sandboxData,
  files,
  selectFile,
  handleRename,
  handleDeleteFile,
  handleDeleteFolder,
  socket,
  setFiles,
  deletingFolderId,
  toggleAIChat,
  isAIChatOpen,
}: FileManagerProps) {
  const [creatingNew, setCreatingNew] = useState<"file" | "folder" | null>(null)
  const [movingId, setMovingId] = useState("")
  const sortedFiles = useMemo(() => {
    return sortFileExplorer(files)
  }, [files])
  const ref = useRef(null) // drop target
  useEffect(() => {
    const el = ref.current

    if (el) {
      return dropTargetForElements({
        element: el,
        getData: () => ({ id: `projects/${sandboxData.id}` }),
        canDrop: ({ source }) => {
          const file = files.find((child) => child.id === source.data.id)
          return !file
        },
      })
    }
  }, [files])

  useEffect(() => {
    return monitorForElements({
      onDrop({ source, location }) {
        const destination = location.current.dropTargets[0]
        if (!destination) {
          return
        }

        const fileId = source.data.id as string
        const folderId = destination.data.id as string

        const fileFolder = fileId.split("/").slice(0, -1).join("/")
        if (fileFolder === folderId) {
          return
        }

        console.log("move file", fileId, "to folder", folderId)

        setMovingId(fileId)
        socket.emit(
          "moveFile",
          {
            fileId,
            folderId,
          },
          (response: (TFolder | TFile)[]) => {
            setFiles(response)
            setMovingId("")
          }
        )
      },
    })
  }, [])
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full select-none flex flex-col text-sm"
    >
      <ScrollArea className="flex-grow overflow-auto px-2 pt-0 pb-4 relative">
        <div className="flex w-full items-center justify-between h-8 pb-1 isolate z-10 sticky pt-2 top-0 bg-background">
          <h2 className="font-medium">Explorer</h2>
          <div className="flex space-x-1">
            <button
              disabled={!!creatingNew}
              onClick={() => setCreatingNew("file")}
              className="h-6 w-6 text-muted-foreground ml-0.5 flex items-center justify-center translate-x-1 bg-transparent hover:bg-muted-foreground/25 cursor-pointer rounded-sm transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 disabled:hover:bg-background"
            >
              <FilePlus className="w-4 h-4" />
            </button>
            <button
              disabled={!!creatingNew}
              onClick={() => setCreatingNew("folder")}
              className="h-6 w-6 text-muted-foreground ml-0.5 flex items-center justify-center translate-x-1 bg-transparent hover:bg-muted-foreground/25 cursor-pointer rounded-sm transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 disabled:hover:bg-background"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
            {/* Todo: Implement file searching */}
            {/* <button className="h-6 w-6 text-muted-foreground ml-0.5 flex items-center justify-center translate-x-1 bg-transparent hover:bg-muted-foreground/25 cursor-pointer rounded-sm transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <Search className="w-4 h-4" />
            </button> */}
          </div>
        </div>
        <div ref={ref} className="rounded-sm w-full mt-1 flex flex-col">
          {/* <div
            ref={ref}
            className={`${
              isDraggedOver ? "bg-secondary/50" : ""
            } rounded-sm w-full mt-1 flex flex-col`}
          > */}
          {sortedFiles.length === 0 ? (
            <div className="w-full flex flex-col justify-center">
              {new Array(6).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-[1.625rem] mb-0.5 rounded-sm" />
              ))}
            </div>
          ) : (
            <>
              {sortedFiles.map((child) =>
                child.type === "file" ? (
                  <SidebarFile
                    key={child.id}
                    data={child}
                    selectFile={selectFile}
                    handleRename={handleRename}
                    handleDeleteFile={handleDeleteFile}
                    movingId={movingId}
                    deletingFolderId={deletingFolderId}
                  />
                ) : (
                  <SidebarFolder
                    key={child.id}
                    data={child}
                    selectFile={selectFile}
                    handleRename={handleRename}
                    handleDeleteFile={handleDeleteFile}
                    handleDeleteFolder={handleDeleteFolder}
                    movingId={movingId}
                    deletingFolderId={deletingFolderId}
                  />
                )
              )}
              {creatingNew !== null ? (
                <New
                  socket={socket}
                  type={creatingNew}
                  stopEditing={() => {
                    setCreatingNew(null)
                  }}
                />
              ) : null}
            </>
          )}
        </div>
      </ScrollArea>
      <div className="flex flex-col p-2 bg-background">
        <Button
          variant="ghost"
          className="w-full justify-start text-sm text-muted-foreground font-normal h-8 px-2 mb-2"
          disabled
          aria-disabled="true"
          style={{ opacity: 1 }}
        >
          <Sparkles className="h-4 w-4 mr-2 text-indigo-500 opacity-70" />
          AI Editor
          <div className="ml-auto">
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <span className="text-xs">⌘</span>G
            </kbd>
          </div>
        </Button>
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start text-sm font-normal h-8 px-2 mb-2 border-t",
            isAIChatOpen
              ? "bg-muted-foreground/25 text-foreground"
              : "text-muted-foreground"
          )}
          onClick={toggleAIChat}
          aria-disabled={false}
          style={{ opacity: 1 }}
        >
          <MessageSquareMore
            className={cn(
              "h-4 w-4 mr-2",
              isAIChatOpen ? "text-indigo-500" : "text-indigo-500 opacity-70"
            )}
          />
          AI Chat
          <div className="ml-auto">
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <span className="text-xs">⌘</span>L
            </kbd>
          </div>
        </Button>
      </div>
    </motion.div>
  )
}
// #endregion File Explorer

// #region Github Sync
function GitHubSync({ repoId }: { repoId?: string }) {
  const queryClient = useQueryClient()
  const [commitMessage, setCommitMessage] = React.useState("")
  const {
    mutate: handleGithubLogin,
    isPending: isLoggingIn,
    data,
  } = useGithubLogin({
    onSuccess: () => {
      refetch()
    },
  })
  const { data: githubUser, refetch } = useGithubUser({
    variables: {
      code: data?.code,
    },
  })
  const { data: RepoStatus } = useCheckSandboxRepo()
  console.log("RepoStatus", RepoStatus,githubUser)
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
      return queryClient.invalidateQueries(
        useCheckSandboxRepo.getFetchOptions({})
      )
    },
  })
  const hasRepo = RepoStatus
    ? RepoStatus.existsInDB && RepoStatus.existsInGitHub
    : false
  const { mutate: handleGithubLogout, isPending: isLoggingOut } =
    useGithubLogout()
  const { mutate: handleCreateRepo, isPending: isCreatingRepo } = useCreateRepo(
    {
      onSuccess() {
        toast.success("Repository created successfully")
        return queryClient.invalidateQueries(useCheckSandboxRepo.getOptions({}))
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
              <Github className="size-3 mr-2" />
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="smIcon" className="size-6">
                      <Avatar
                        className="size-6"
                        name={githubUser.name}
                        avatarUrl={githubUser.avatar_url}
                      />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
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
                            <a href={githubUser.html_url} target="_blank">
                              View profile
                            </a>
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                  </DropdownMenuContent>
                </DropdownMenu>
                <div>
                  <a
                    href={`${githubUser.html_url}/${RepoStatus?.repo?.name}`}
                    className="text-xs font-medium hover:underline"
                  >
                    {RepoStatus?.repo?.name}
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
                        // handleGithubLogout()
                        deleteRepo({
                          repoId: RepoStatus?.repo?.id ?? "",
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
                className="!text-xs"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
              />
              <Button
                variant="secondary"
                size="xs"
                className="w-full font-normal"
                onClick={() =>
                  syncToGithub({
                    repoId: RepoStatus?.repo?.id!,
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
            <Button
              variant="secondary"
              size="xs"
              className="mt-4 w-full font-normal"
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
  ])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full select-none flex flex-col text-sm w-56"
    >
      <ScrollArea className="flex-grow overflow-auto px-2 pt-0 pb-4 relative">
        <div className="flex flex-col gap-3 w-full pt-2">
          <div className="flex items-center justify-between w-full">
            <h2 className="font-medium">Sync to GitHub</h2>
          </div>
          {content}
        </div>
      </ScrollArea>
    </motion.div>
  )
}
// #endregion Github Sync

// #region SidebarButton
const SidebarButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    asChild?: boolean
    isActive?: boolean
    tooltip?: string | React.ComponentProps<typeof TooltipContent>
  } & VariantProps<typeof buttonVariants>
>(
  (
    {
      asChild = false,
      isActive = false,
      variant = "ghost",
      size = "smIcon",
      tooltip,
      className,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button"
    // const { isMobile, state } = useSidebar()

    const button = (
      <Comp
        ref={ref}
        data-active={isActive}
        className={cn(
          buttonVariants({ variant: isActive ? "secondary" : variant, size }),
          className
        )}
        {...props}
      />
    )

    if (!tooltip) {
      return button
    }

    if (typeof tooltip === "string") {
      tooltip = {
        children: tooltip,
      }
    }

    return (
      <div className="relative">
        {isActive && (
          <motion.div
            layoutId="sidebar-indicator"
            className="absolute -left-2 top-0 right-0 w-[2px] h-full bg-primary rounded-full"
          />
        )}
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="right" align="center" {...tooltip} />
        </Tooltip>
      </div>
    )
  }
)
SidebarButton.displayName = "SidebarButton"
// #endregion SidebarButton

{
  /* <DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="smIcon" className="size-6">
      <Ellipsis size={16} />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent className="w-56">
    {githubUser ? (
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
              <a href={githubUser.html_url} target="_blank">
                View profile
              </a>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuPortal>
      </DropdownMenuSub>
    ) : (
      <DropdownMenuItem onClick={() => handleGithubLogin()}>
        Login
      </DropdownMenuItem>
    )}
  </DropdownMenuContent>
</DropdownMenu> */
}
