"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { toggleLike } from "@/lib/actions"
import { projectTemplates } from "@/lib/data"
import { Sandbox } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useRouter } from "@bprogress/next/app"
import { useUser } from "@clerk/nextjs"
import { AnimatePresence, motion } from "framer-motion"
import { Clock, Eye, Globe, Heart, Lock } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import {
  memo,
  MouseEventHandler,
  useEffect,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
} from "react"
import ProjectCardDropdown from "./dropdown"
import { CanvasRevealEffect } from "./revealEffect"

type BaseProjectCardProps = {
  id: string
  name: string
  type: string
  visibility: "public" | "private"
  createdAt: Date
  likeCount: number
  liked?: boolean
  viewCount: number
}

type AuthenticatedProjectCardProps = BaseProjectCardProps & {
  isAuthenticated: true
  onVisibilityChange: (
    sandbox: Pick<Sandbox, "id" | "name" | "visibility">
  ) => void
  onDelete: (sandbox: Pick<Sandbox, "id" | "name">) => void
  deletingId: string
}

type UnauthenticatedProjectCardProps = BaseProjectCardProps & {
  isAuthenticated: false
}

type ProjectCardProps =
  | AuthenticatedProjectCardProps
  | UnauthenticatedProjectCardProps

const StatItem = memo(({ icon: Icon, value }: { icon: any; value: number }) => (
  <div className="flex items-center space-x-1">
    <Icon className="size-4" />
    <span className="text-xs">{value}</span>
  </div>
))

StatItem.displayName = "StatItem"

const formatDate = (date: Date): string => {
  const now = new Date()
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000)

  if (diffInMinutes < 1) return "Now"
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
  return `${Math.floor(diffInMinutes / 1440)}d ago`
}

const ProjectMetadata = memo(
  ({
    id,
    visibility,
    createdAt,
    likeCount,
    liked,
    viewCount,
  }: Pick<
    BaseProjectCardProps,
    "visibility" | "createdAt" | "likeCount" | "liked" | "viewCount" | "id"
  >) => {
    const { user } = useUser()
    const [date, setDate] = useState<string>()
    const Icon = visibility === "private" ? Lock : Globe
    useEffect(() => {
      setDate(formatDate(new Date(createdAt)))
    }, [createdAt])

    return (
      <div className="flex flex-col text-muted-foreground space-y-2 text-sm z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="size-4" />
            <span className="text-xs">
              {visibility === "private" ? "Private" : "Public"}
            </span>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-2">
            <Clock className="size-4" /> <span className="text-xs">{date}</span>
          </div>
          <LikeButton
            sandboxId={id}
            initialIsLiked={!!liked}
            initialLikeCount={likeCount}
            userId={user?.id ?? null}
          />
          <StatItem icon={Eye} value={viewCount} />
        </div>
      </div>
    )
  }
)

ProjectMetadata.displayName = "ProjectMetadata"

interface LikeButtonProps {
  sandboxId: string
  userId: string | null
  initialLikeCount: number
  initialIsLiked: boolean
}

export function LikeButton({
  sandboxId,
  userId,
  initialLikeCount,
  initialIsLiked,
}: LikeButtonProps) {
  // Optimistic state for like status and count
  const [{ isLiked, likeCount }, optimisticUpdateLike] = useOptimistic(
    { isLiked: initialIsLiked, likeCount: initialLikeCount },
    (state, optimisticValue: boolean) => {
      return {
        isLiked: optimisticValue,
        likeCount: state.likeCount + (optimisticValue ? 1 : -1),
      }
    }
  )

  const [isPending, startTransition] = useTransition()

  const handleLike: MouseEventHandler<HTMLButtonElement> = async (e) => {
    e.stopPropagation() // Prevent click event from bubbling up which leads to navigation to /code/:id
    if (!userId) return

    startTransition(async () => {
      const newLikeState = !isLiked
      try {
        optimisticUpdateLike(newLikeState)
        await toggleLike(sandboxId, userId)
      } catch (error) {
        console.log("error", error)
        optimisticUpdateLike(!newLikeState)
      }
    })
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={!userId || isPending}
      onClick={handleLike}
      className="gap-1 px-1 rounded-full"
    >
      <Heart
        className={cn("size-4", isLiked ? "stroke-red-500 fill-red-500" : "")}
      />
      <span className="text-xs">{likeCount}</span>
    </Button>
  )
}
function ProjectCardComponent({
  id,
  name,
  type,
  visibility,
  createdAt,
  likeCount,
  viewCount,
  ...props
}: ProjectCardProps) {
  const [hovered, setHovered] = useState(false)
  const router = useRouter()

  const projectIcon = useMemo(
    () =>
      projectTemplates.find((p) => p.id === type)?.icon ??
      "/project-icons/node.svg",
    [type]
  )

  const handleVisibilityChange = () => {
    if (props.isAuthenticated) {
      props.onVisibilityChange({
        id,
        name,
        visibility,
      })
    }
  }

  const handleDelete = () => {
    if (props.isAuthenticated) {
      props.onDelete({
        id,
        name,
      })
    }
  }

  return (
    <Card
      tabIndex={0}
      onClick={() => router.push(`/code/${id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`
        group/canvas-card p-4 h-48 flex flex-col justify-between items-start 
        hover:border-muted-foreground/50 relative overflow-hidden transition-all
        ${
          props.isAuthenticated && props.deletingId === id
            ? "opacity-50 pointer-events-none cursor-events-none"
            : "cursor-pointer"
        }
      `}
    >
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-full w-full absolute inset-0"
          >
            <CanvasRevealEffect
              animationSpeed={3}
              containerClassName="bg-muted"
              colors={colors[type]}
              dotSize={2}
            />
            <div className="absolute inset-0 [mask-image:radial-gradient(400px_at_center,white,transparent)] bg-background/75" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-x-2 flex items-center justify-start w-full z-10">
        <Image
          alt={`${type} project icon`}
          src={projectIcon}
          width={20}
          height={20}
        />
        <Link
          href={`/code/${id}`}
          className="font-medium static whitespace-nowrap w-full text-ellipsis overflow-hidden before:content-[''] before:absolute before:z-0 before:top-0 before:left-0 before:w-full before:h-full before:rounded-xl"
        >
          {name}
        </Link>
        {props.isAuthenticated && (
          <ProjectCardDropdown
            onVisibilityChange={handleVisibilityChange}
            onDelete={handleDelete}
            visibility={visibility}
          />
        )}
      </div>

      <ProjectMetadata
        visibility={visibility}
        createdAt={createdAt}
        likeCount={likeCount}
        viewCount={viewCount}
        id={id}
        liked={props.liked}
      />
    </Card>
  )
}

ProjectCardComponent.displayName = "ProjectCard"

const ProjectCard = memo(ProjectCardComponent)

export default ProjectCard

const colors: { [key: string]: number[][] } = {
  react: [
    [71, 207, 237],
    [30, 126, 148],
  ],
  node: [
    [86, 184, 72],
    [59, 112, 52],
  ],
}
