"use client"

import NewProjectModal from "@/components/dashboard/newProject"
import ProjectCard from "@/components/dashboard/projectCard/"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { deleteSandbox, updateSandbox, updateUser } from "@/lib/actions"
import { TIERS } from "@/lib/tiers"
import { SandboxWithLiked, User } from "@/lib/types"
import { useUser } from "@clerk/nextjs"
import {
  Edit,
  Heart,
  Info,
  Loader2,
  LucideIcon,
  Package2,
  PlusCircle,
  Sparkles,
  X,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { useFormState, useFormStatus } from "react-dom"
import { toast } from "sonner"
import Avatar from "../ui/avatar"
import { Badge } from "../ui/badge"
import { Input } from "../ui/input"
import { Progress } from "../ui/progress"

// #region Profile Page
export default function ProfilePage({
  publicSandboxes,
  privateSandboxes,
  profileOwner,
  loggedInUser,
}: {
  publicSandboxes: SandboxWithLiked[]
  privateSandboxes: SandboxWithLiked[]
  profileOwner: User
  loggedInUser: User | null
}) {
  const isOwnProfile = profileOwner.id === loggedInUser?.id

  const sandboxes = useMemo(() => {
    const allSandboxes = isOwnProfile
      ? [...publicSandboxes, ...privateSandboxes]
      : publicSandboxes

    return allSandboxes
  }, [isOwnProfile, publicSandboxes, privateSandboxes])

  return (
    <>
      <div className="container mx-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <ProfileCard
            name={profileOwner.name}
            username={profileOwner.username}
            avatarUrl={profileOwner.avatarUrl}
            sandboxes={sandboxes}
            joinedDate={profileOwner.createdAt}
            generations={isOwnProfile ? loggedInUser.generations : undefined}
            isOwnProfile={isOwnProfile}
            tier={profileOwner.tier}
          />
        </div>
        <div className="md:col-span-2">
          <SandboxesPanel
            {...{
              publicSandboxes,
              privateSandboxes,
              isOwnProfile,
            }}
          />
        </div>
      </div>
    </>
  )
}
// #endregion

// #region Profile Card
function ProfileCard({
  name,
  username,
  avatarUrl,
  sandboxes,
  joinedDate,
  generations,
  isOwnProfile,
  tier,
}: {
  name: string
  username: string
  avatarUrl: string | null
  sandboxes: SandboxWithLiked[]
  joinedDate: Date
  generations?: number
  isOwnProfile: boolean
  tier: string
}) {
  const { user } = useUser()
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [formState, formAction] = useFormState(updateUser, {})
  const joinedAt = useMemo(() => {
    const date = new Date(joinedDate).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    })
    return `Joined ${date}`
  }, [joinedDate])
  const toggleEdit = useCallback(() => {
    setIsEditing((s) => !s)
  }, [])
  const stats = useMemo(() => {
    const totalSandboxes = sandboxes.length
    const totalLikes = sandboxes.reduce(
      (sum, sandbox) => sum + sandbox.likeCount,
      0
    )

    return {
      sandboxes:
        totalSandboxes === 1 ? "1 sandbox" : `${totalSandboxes} sandboxes`,
      likes: totalLikes === 1 ? "1 like" : `${totalLikes} likes`,
    }
  }, [sandboxes])

  useEffect(() => {
    if ("message" in formState) {
      toast.success(formState.message as String)
      toggleEdit()
      if ("newRoute" in formState && typeof formState.newRoute === "string") {
        router.replace(formState.newRoute)
      }
    }
    if ("error" in formState) {
      const error = formState.error
      if (typeof error === "string") {
        toast.error(error)
      } else {
        toast.error("An Error Occured")
      }
    }
  }, [formState])
  return (
    <Card className="mb-6 md:mb-0 sticky top-6">
      {isOwnProfile && (
        <Button
          onClick={toggleEdit}
          aria-label={isEditing ? "close edit form" : "open edit form"}
          size="smIcon"
          variant="secondary"
          className="rounded-full absolute top-2 right-2"
        >
          {isEditing ? <X className="size-4" /> : <Edit className="size-4" />}
        </Button>
      )}
      <CardContent className="flex flex-col gap-4 items-center pt-6">
        <Avatar name={name} avatarUrl={avatarUrl} className="size-36" />

        {!isEditing ? (
          <div className="space-y-2">
            <CardTitle className="text-2xl text-center">{name}</CardTitle>
            <CardDescription className="text-center">{`@${username}`}</CardDescription>
          </div>
        ) : (
          <form action={formAction} className="flex flex-col gap-2">
            <Input
              name="id"
              placeholder="ID"
              className="hidden "
              value={user?.id}
            />
            <Input
              name="oldUsername"
              placeholder="ID"
              className="hidden "
              value={user?.username ?? undefined}
            />
            <div className="space-y-1">
              <Label htmlFor="input-name">Name</Label>
              <Input
                id="input-name"
                name="name"
                placeholder="Name"
                defaultValue={name}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="input-username">User name</Label>
              <div className="relative">
                <Input
                  id="input-username"
                  className="peer ps-6"
                  type="text"
                  name="username"
                  placeholder="Username"
                  defaultValue={username}
                />
                <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-2 text-sm text-muted-foreground peer-disabled:opacity-50">
                  @
                </span>
              </div>
            </div>

            <SubmitButton />
          </form>
        )}
        {!isEditing && (
          <>
            <div className="flex gap-6">
              <StatsItem icon={Package2} label={stats.sandboxes} />
              <StatsItem icon={Heart} label={stats.likes} />
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-muted-foreground">{joinedAt}</p>
              {typeof generations === "number" && (
                <SubscriptionBadge
                  generations={generations}
                  tier={tier as keyof typeof TIERS}
                />
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button size="sm" type="submit" className="w-full mt-2" disabled={pending}>
      {pending && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
      Save
    </Button>
  )
}
// #endregion

// #region Sandboxes Panel
function SandboxesPanel({
  publicSandboxes,
  privateSandboxes,
  isOwnProfile,
}: {
  publicSandboxes: SandboxWithLiked[]
  privateSandboxes: SandboxWithLiked[]
  isOwnProfile: boolean
}) {
  const [deletingId, setDeletingId] = useState<string>("")
  const hasPublicSandboxes = publicSandboxes.length > 0
  const hasPrivateSandboxes = privateSandboxes.length > 0

  const onVisibilityChange = useMemo(
    () =>
      async (sandbox: Pick<SandboxWithLiked, "id" | "name" | "visibility">) => {
        const newVisibility =
          sandbox.visibility === "public" ? "private" : "public"
        toast(`Project ${sandbox.name} is now ${newVisibility}.`)
        await updateSandbox({
          id: sandbox.id,
          visibility: newVisibility,
        })
      },
    []
  )

  const onDelete = useMemo(
    () => async (sandbox: Pick<SandboxWithLiked, "id" | "name">) => {
      setDeletingId(sandbox.id)
      toast(`Project ${sandbox.name} deleted.`)
      await deleteSandbox(sandbox.id)
      setDeletingId("")
    },
    []
  )
  if (!isOwnProfile) {
    return (
      <div className="">
        {hasPublicSandboxes ? (
          <>
            <h2 className="font-semibold text-xl mb-4">Sandboxes</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {publicSandboxes.map((sandbox) => {
                return (
                  <Fragment key={sandbox.id}>
                    {isOwnProfile ? (
                      <ProjectCard
                        onVisibilityChange={onVisibilityChange}
                        onDelete={onDelete}
                        deletingId={deletingId}
                        isAuthenticated
                        {...sandbox}
                      />
                    ) : (
                      <ProjectCard isAuthenticated={false} {...sandbox} />
                    )}
                  </Fragment>
                )
              })}
            </div>
          </>
        ) : (
          <EmptyState type="private" isOwnProfile={isOwnProfile} />
        )}
      </div>
    )
  }
  return (
    <Tabs defaultValue="public">
      <TabsList className="mb-4">
        <TabsTrigger value="public">Public</TabsTrigger>
        <TabsTrigger value="private">Private</TabsTrigger>
      </TabsList>
      <TabsContent value="public">
        {hasPublicSandboxes ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {publicSandboxes.map((sandbox) => {
              return (
                <Fragment key={sandbox.id}>
                  {isOwnProfile ? (
                    <ProjectCard
                      onVisibilityChange={onVisibilityChange}
                      onDelete={onDelete}
                      deletingId={deletingId}
                      isAuthenticated
                      {...sandbox}
                    />
                  ) : (
                    <ProjectCard isAuthenticated={false} {...sandbox} />
                  )}
                </Fragment>
              )
            })}
          </div>
        ) : (
          <EmptyState type="public" isOwnProfile={isOwnProfile} />
        )}
      </TabsContent>
      <TabsContent value="private">
        {hasPrivateSandboxes ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {privateSandboxes.map((sandbox) => (
              <ProjectCard
                key={sandbox.id}
                onVisibilityChange={onVisibilityChange}
                onDelete={onDelete}
                deletingId={deletingId}
                isAuthenticated
                {...sandbox}
              />
            ))}
          </div>
        ) : (
          <EmptyState type="private" isOwnProfile={isOwnProfile} />
        )}
      </TabsContent>
    </Tabs>
  )
}
// #endregion

// #region Empty State
function EmptyState({
  type,
  isOwnProfile,
}: {
  type: "public" | "private"
  isOwnProfile: boolean
}) {
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false)

  const text = useMemo(() => {
    let title: string
    let description: string
    switch (type) {
      case "public":
        title = "No public sandboxes yet"
        description = isOwnProfile
          ? "Create your first public sandbox to share your work with the world!"
          : "user has no public sandboxes"

      case "private":
        title = "No private sandboxes yet"
        description = isOwnProfile
          ? "Create your first private sandbox to start working on your personal projects!"
          : "user has no private sandboxes"
    }
    return {
      title,
      description,
    }
  }, [type, isOwnProfile])
  const openModal = useCallback(() => setNewProjectModalOpen(true), [])
  return (
    <>
      <Card className="flex flex-col items-center justify-center p-6 text-center h-[300px]">
        <PlusCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <CardTitle className="text-xl mb-2">{text.title}</CardTitle>
        <CardDescription className="mb-4">{text.description}</CardDescription>
        {isOwnProfile && (
          <Button onClick={openModal}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Create Sandbox
          </Button>
        )}
      </Card>
      <NewProjectModal
        open={newProjectModalOpen}
        setOpen={setNewProjectModalOpen}
      />
    </>
  )
}
// #endregion

// #region StatsItem
interface StatsItemProps {
  icon: LucideIcon
  label: string
}

const StatsItem = ({ icon: Icon, label }: StatsItemProps) => (
  <div className="flex items-center gap-2">
    <Icon size={18} />
    <span className="text-sm  text-muted-foreground">{label}</span>
  </div>
)
// #endregion

// #region Sub Badge
const SubscriptionBadge = ({
  generations,
  tier = "FREE",
}: {
  generations: number
  tier?: keyof typeof TIERS
}) => {
  return (
    <div className="flex gap-2 items-center">
      <Badge variant="secondary" className="text-sm cursor-pointer">
        {tier}
      </Badge>
      <HoverCard>
        <HoverCardTrigger>
          <Button variant="ghost" size="smIcon">
            <Info size={20} />
          </Button>
        </HoverCardTrigger>
        <HoverCardContent>
          <div className="w-full space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">AI Generations</span>
              <span>{`${generations} / ${TIERS[tier].generations}`}</span>
            </div>
            <Progress
              value={generations}
              max={TIERS[tier].generations}
              className="w-full"
            />
          </div>
          <Button size="sm" className="w-full mt-4">
            <Sparkles className="mr-2 h-4 w-4" /> Upgrade to Pro
          </Button>
        </HoverCardContent>
      </HoverCard>
    </div>
  )
}
// #endregion
