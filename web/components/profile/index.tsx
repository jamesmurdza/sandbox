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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { deleteSandbox, updateSandbox, updateUser } from "@/lib/api/actions"
import { socialIcons } from "@/lib/data"
import { editUserSchema, EditUserSchema } from "@/lib/schema"
import { TIERS } from "@/lib/tiers"
import { SandboxWithLiked, User, UserLink } from "@/lib/types"
import { cn, parseSocialLink } from "@/lib/utils"
import { useRouter } from "@bprogress/next/app"
import { useUser } from "@clerk/nextjs"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Edit,
  Globe,
  Heart,
  Info,
  Loader2,
  LucideIcon,
  Package2,
  PlusCircle,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"
import { useFormState, useFormStatus } from "react-dom"
import { useFieldArray, useForm } from "react-hook-form"
import { toast } from "sonner"
import Avatar from "../ui/avatar"
import { Badge } from "../ui/badge"
import { Input } from "../ui/input"
import { Progress } from "../ui/progress"
import { Textarea } from "../ui/textarea"
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
            joinedDate={new Date(profileOwner.createdAt)}
            generations={isOwnProfile ? loggedInUser.generations : undefined}
            isOwnProfile={isOwnProfile}
            tier={profileOwner.tier}
            bio={profileOwner.bio}
            personalWebsite={profileOwner.personalWebsite}
            socialLinks={profileOwner.links}
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
  bio,
  personalWebsite,
  socialLinks = [],
  tier,
}: {
  name: string
  username: string
  avatarUrl: string | null
  bio: string | null
  personalWebsite: string | null
  socialLinks: UserLink[]
  sandboxes: SandboxWithLiked[]
  joinedDate: Date
  generations?: number
  isOwnProfile: boolean
  tier: string
}) {
  const { user } = useUser()
  const [isEditing, setIsEditing] = useState(false)

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

  const showAddMoreInfoBanner = useMemo(() => {
    return !bio && !personalWebsite && (socialLinks?.length ?? 0) === 0
  }, [personalWebsite, bio, socialLinks])

  return (
    <Card className="mb-6 md:mb-0 sticky top-6">
      {isOwnProfile && (
        <div className="absolute top-2 right-2 flex flex-col gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={toggleEdit}
                aria-label={isEditing ? "close edit form" : "open edit form"}
                size="smIcon"
                variant="secondary"
                className="rounded-full relative"
              >
                {isEditing ? (
                  <X className="size-4" />
                ) : showAddMoreInfoBanner ? (
                  <>
                    <Sparkles className="size-4 text-yellow-400 z-[2]" />
                    <div className="z-[1] absolute inset-0 rounded-full bg-secondary animate-ping" />
                  </>
                ) : (
                  <Edit className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {showAddMoreInfoBanner
                  ? "Add more information to your profile"
                  : "Edit your profile"}
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
      )}
      <CardContent className="flex flex-col gap-4 pt-6">
        {isEditing ? (
          <div className="flex flex-col gap-2 items-center ">
            <Avatar name={name} avatarUrl={avatarUrl} className="size-36" />
            <EditProfileForm
              {...{
                name,
                username,
                avatarUrl,
                bio,
                personalWebsite,
                socialLinks,
                toggleEdit,
              }}
            />
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2 items-center">
              <Avatar name={name} avatarUrl={avatarUrl} className="size-36" />
              <div className="space-y-1">
                <CardTitle className="text-2xl text-center">{name}</CardTitle>
                <CardDescription className="text-center">{`@${username}`}</CardDescription>
              </div>
              {bio && <p className="text-sm text-center">{bio}</p>}
              {((Array.isArray(socialLinks) && socialLinks.length > 0) ||
                personalWebsite) && (
                <div className="flex gap-2 justify-center">
                  {personalWebsite && (
                    <Button variant="secondary" size="smIcon" asChild>
                      <a
                        href={personalWebsite}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Globe className="size-4" />
                        <span className="sr-only">Personal Website</span>
                      </a>
                    </Button>
                  )}
                  {Array.isArray(socialLinks) &&
                    socialLinks.map((link, index) => {
                      const Icon = socialIcons[link.platform]
                      return (
                        <Button
                          key={index}
                          variant="secondary"
                          size="smIcon"
                          asChild
                        >
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Icon className="size-4" />
                            <span className="sr-only">{link.platform}</span>
                          </a>
                        </Button>
                      )
                    })}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1 items-center">
              {typeof generations === "number" && (
                <div className="flex justify-center">
                  <SubscriptionBadge
                    generations={generations}
                    tier={tier as keyof typeof TIERS}
                  />
                </div>
              )}
              <div className="flex gap-4">
                <StatsItem icon={Package2} label={stats.sandboxes} />
                <StatsItem icon={Heart} label={stats.likes} />
              </div>
            </div>
            <p className="text-xs mt-2 text-muted-foreground text-center">
              {joinedAt}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function EditProfileForm(props: {
  name: string
  username: string
  avatarUrl: string | null
  bio: string | null
  personalWebsite: string | null
  socialLinks: UserLink[]
  toggleEdit: () => void
}) {
  const router = useRouter()
  const { user } = useUser()
  const formRef = useRef<HTMLFormElement>(null)
  const [formState, formAction] = useFormState(updateUser, {
    message: "",
  })
  const [isPending, startTransition] = useTransition()
  const { name, username, bio, personalWebsite, socialLinks, toggleEdit } =
    props
  const form = useForm<EditUserSchema>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      oldUsername: username,
      id: user?.id,
      name,
      username,
      bio: bio ?? "",
      personalWebsite: personalWebsite ?? "",
      links:
        socialLinks.length > 0
          ? socialLinks
          : [{ url: "", platform: "generic" }],
      ...(formState.fields ?? {}),
    },
  })
  const { fields, append, remove } = useFieldArray({
    name: "links",
    control: form.control,
  })
  useEffect(() => {
    const message = formState.message
    if (!Boolean(message)) return
    if ("error" in formState) {
      toast.error(formState.message)
      return
    }
    toast.success(formState.message as String)
    toggleEdit()
    if (formState?.newRoute) {
      router.replace(formState.newRoute)
    }
  }, [formState])
  return (
    <Form {...form}>
      <form
        ref={formRef}
        action={formAction}
        onSubmit={(evt) => {
          evt.preventDefault()
          form.handleSubmit(() => {
            startTransition(() => {
              formAction(new FormData(formRef.current!))
            })
          })(evt)
        }}
        className="space-y-3 w-full"
      >
        <input type="hidden" name="id" value={user?.id} />
        <input type="hidden" name="oldUsername" value={username} />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="marie doe" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>User name</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    className="peer ps-6"
                    type="text"
                    placeholder="Username"
                    {...field}
                  />
                  <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-2 text-sm text-muted-foreground peer-disabled:opacity-50">
                    @
                  </span>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bio</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="hi, I love building things!"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="personalWebsite"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Personal Website</FormLabel>
              <FormControl>
                <Input placeholder="https://chillguy.dev" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div>
          {fields.map((field, index) => (
            <FormField
              control={form.control}
              key={field.id}
              name={`links.${index}`}
              render={({ field: { onChange, value, ...field } }) => {
                const Icon = socialIcons[value.platform] ?? socialIcons.generic
                return (
                  <FormItem>
                    <FormLabel className={cn(index !== 0 && "sr-only")}>
                      Social Links
                    </FormLabel>
                    <FormDescription className={cn(index !== 0 && "sr-only")}>
                      Add links to your blogs or social media profiles.
                    </FormDescription>
                    <FormControl>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            {...field}
                            className="peer ps-9"
                            value={value.url}
                            onChange={(e) =>
                              onChange(parseSocialLink(e.currentTarget.value))
                            }
                          />
                          <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 text-muted-foreground/80 peer-disabled:opacity-50">
                            <Icon
                              size={16}
                              strokeWidth={2}
                              aria-hidden="true"
                            />
                          </div>
                        </div>
                        <Button
                          size="smIcon"
                          type="button"
                          variant="secondary"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )
              }}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => append({ url: "", platform: "generic" })}
          >
            Add URL
          </Button>
        </div>
        <SubmitButton {...{ isPending }} />
      </form>
    </Form>
  )
}
function SubmitButton({ isPending }: { isPending: boolean }) {
  const formStatus = useFormStatus()
  const { pending } = formStatus
  const pend = pending || isPending
  return (
    <Button size="sm" type="submit" className="w-full mt-2" disabled={pend}>
      {pend && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
      Save Changes
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
                        createdAt={new Date(sandbox.createdAt)}
                      />
                    ) : (
                      <ProjectCard
                        isAuthenticated={false}
                        {...sandbox}
                        createdAt={new Date(sandbox.createdAt)}
                      />
                    )}
                  </Fragment>
                )
              })}
            </div>
          </>
        ) : (
          <EmptyState type="public" isOwnProfile={isOwnProfile} />
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
                      createdAt={new Date(sandbox.createdAt)}
                    />
                  ) : (
                    <ProjectCard
                      isAuthenticated={false}
                      {...sandbox}
                      createdAt={new Date(sandbox.createdAt)}
                    />
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
                createdAt={new Date(sandbox.createdAt)}
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
    let title = ""
    let description = ""

    switch (type) {
      case "public":
        title = "No public sandboxes yet"
        description = isOwnProfile
          ? "Create your first public sandbox to share your work with the world!"
          : "User has no public sandboxes"
        break

      case "private":
        title = "No private sandboxes yet"
        description = isOwnProfile
          ? "Create your first private sandbox to start working on your personal projects!"
          : "User has no private sandboxes"
        break

      default:
        title = "No sandboxes"
        description = "Nothing to show here yet."
    }

    return { title, description }
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
    <Icon size={16} />
    <span className="text-sm text-muted-foreground">{label}</span>
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
          <Button variant="ghost" size="smIcon" className="size-[26px]">
            <Info size={16} />
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
