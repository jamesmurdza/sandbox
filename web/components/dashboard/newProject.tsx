"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { zodResolver } from "@hookform/resolvers/zod"
import Image from "next/image"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createSandbox } from "@/lib/api/actions"
import { useRouter } from "@bprogress/next/app"
import { useUser } from "@clerk/nextjs"
import { projectTemplates } from "@gitwit/templates"
import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react"
import { Button } from "../ui/button"

import { cn } from "@/lib/utils"
import type { EmblaCarouselType } from "embla-carousel"
import useEmblaCarousel from "embla-carousel-react"
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures"
const formSchema = z.object({
  name: z
    .string()
    .min(1, "Project name is required")
    .max(16, "Project name must be 16 characters or less")
    .transform((val) => val.trim())
    .refine(
      (value) => value.length > 0,
      "Project name cannot be empty or only spaces"
    )
    .refine(
      (value) => /^[a-zA-Z0-9_ ]+$/.test(value),
      "Project name can only contain letters, numbers, underscores, and spaces"
    )
    .refine(
      (value) => !/  /.test(value),
      "Name must be alphanumeric and can contain underscores"
    ),
  visibility: z.enum(["public", "private"]),
})

export default function NewProjectModal({
  open,
  setOpen,
}: {
  open: boolean
  setOpen: (open: boolean) => void
}) {
  const router = useRouter()
  const user = useUser()
  const [selected, setSelected] = useState("reactjs")
  const [loading, setLoading] = useState(false)
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false }, [
    WheelGesturesPlugin(),
  ])
  const {
    prevBtnDisabled,
    nextBtnDisabled,
    onPrevButtonClick,
    onNextButtonClick,
  } = usePrevNextButtons(emblaApi)
  const [search, setSearch] = useState("")

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      visibility: "public",
    },
  })

  const handleTemplateClick = useCallback(
    ({ id, index }: { id: string; index: number }) => {
      setSelected(id)
      emblaApi?.scrollTo(index)
    },
    [emblaApi]
  )
  const filteredTemplates = useMemo(
    () =>
      projectTemplates.filter(
        (item) =>
          item.name.toLowerCase().includes(search.toLowerCase()) ||
          item.description.toLowerCase().includes(search.toLowerCase())
      ),
    [search, projectTemplates]
  )
  const emptyTemplates = useMemo(
    () => filteredTemplates.length === 0,
    [filteredTemplates]
  )
  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user.isSignedIn) return

    const sandboxData = { type: selected, userId: user.user.id, ...values }
    setLoading(true)

    const id = await createSandbox(sandboxData)
    router.push(`/code/${id}`)
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(open: boolean) => {
        if (!loading) setOpen(open)
      }}
    >
      <DialogContent className="max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create A Sandbox</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2 max-w-full overflow-hidden">
          <div className="flex items-center justify-end">
            <SearchInput
              {...{
                value: search,
                onValueChange: setSearch,
              }}
            />
          </div>
          <div className="overflow-hidden relative" ref={emblaRef}>
            <div
              className={cn(
                "grid grid-flow-col gap-x-2  min-h-[97px]",
                emptyTemplates ? "auto-cols-[100%]" : "auto-cols-[200px]"
              )}
            >
              {filteredTemplates.map((item, i) => (
                <button
                  disabled={item.disabled || loading}
                  key={item.id}
                  onClick={handleTemplateClick.bind(null, {
                    id: item.id,
                    index: i,
                  })}
                  className={cn(
                    selected === item.id
                      ? "shadow-foreground"
                      : "shadow-border",
                    "shadow-[0_0_0_1px_inset] rounded-md border bg-card text-card-foreground text-left p-4 flex flex-col transition-all focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  <div className="space-x-2 flex items-center justify-start w-full">
                    <Image alt="" src={item.icon} width={20} height={20} />
                    <div className="font-medium">{item.name}</div>
                  </div>
                  <div className="mt-2 text-muted-foreground text-xs line-clamp-2">
                    {item.description}
                  </div>
                </button>
              ))}
              {emptyTemplates && (
                <div className="flex flex-col gap-2 items-center text-center justify-center text-muted-foreground text-sm">
                  <p>No templates found</p>
                  <Button size="xs" asChild>
                    <a
                      href="https://github.com/jamesmurdza/gitwit"
                      target="_blank"
                    >
                      Contribute
                    </a>
                  </Button>
                </div>
              )}
            </div>
            <div
              className={cn(
                "absolute transition-all opacity-100 duration-400 bg-gradient-to-r from-background via-background to-transparent w-14 pl-1 left-0 top-0 -translate-x-1 bottom-0 h-full flex items-center",
                prevBtnDisabled && "opacity-0 pointer-events-none"
              )}
            >
              <Button
                size="smIcon"
                className="rounded-full"
                onClick={onPrevButtonClick}
              >
                <ChevronLeft className="size-5" />
              </Button>
            </div>
            <div
              className={cn(
                "absolute transition-all opacity-100 duration-400 bg-gradient-to-l from-background via-background to-transparent w-14 pl-1 right-0 top-0 translate-x-1 bottom-0 h-full flex items-center",
                nextBtnDisabled && "opacity-0 pointer-events-none"
              )}
            >
              <Button
                size="smIcon"
                className="rounded-full"
                onClick={onNextButtonClick}
              >
                <ChevronRight className="size-5" />
              </Button>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form autoComplete="off" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="mb-4">
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="My Project"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="visibility"
              render={({ field }) => (
                <FormItem className="mb-8">
                  <FormLabel>Visibility</FormLabel>
                  <Select
                    disabled={loading}
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Note: All sandboxes cannot be seen by the public. Private
                    sandboxes cannot be accessed by shared users that you add,
                    while public sandboxes can.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button disabled={loading} type="submit" className="w-full">
              {loading ? (
                <>
                  <Loader2 className="animate-spin mr-2 h-4 w-4" /> Creating
                  project...
                </>
              ) : (
                "Submit"
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function SearchInput({
  value,
  onValueChange,
}: {
  value?: string
  onValueChange?: (value: string) => void
}) {
  const onSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
  }, [])
  return (
    <form {...{ onSubmit }} className="w-40 h-8 ">
      <label
        htmlFor="template-search"
        className="flex gap-2 rounded-sm transition-colors bg-gray-100 dark:bg-[#2e2e2e] border border-[--s-color] [--s-color:hsl(var(--muted-foreground))]  focus-within:[--s-color:hsl(var(--muted-foreground),50%)]  h-full items-center px-2"
      >
        <Search className="size-4 text-[--s-color] transition-colors" />
        <input
          id="template-search"
          type="text"
          name="search"
          placeholder="Search templates"
          value={value}
          onChange={(e) => onValueChange?.(e.target.value)}
          className="bg-transparent placeholder:text-muted-foreground w-full focus:outline-none text-xs"
        />
      </label>
    </form>
  )
}
const usePrevNextButtons = (emblaApi: EmblaCarouselType | undefined) => {
  const [prevBtnDisabled, setPrevBtnDisabled] = useState(true)
  const [nextBtnDisabled, setNextBtnDisabled] = useState(true)

  const onPrevButtonClick = useCallback(() => {
    if (!emblaApi) return
    emblaApi.scrollPrev()
  }, [emblaApi])

  const onNextButtonClick = useCallback(() => {
    if (!emblaApi) return
    emblaApi.scrollNext()
  }, [emblaApi])

  const onSelect = useCallback((emblaApi: EmblaCarouselType) => {
    setPrevBtnDisabled(!emblaApi.canScrollPrev())
    setNextBtnDisabled(!emblaApi.canScrollNext())
  }, [])

  useEffect(() => {
    if (!emblaApi) return

    onSelect(emblaApi)
    emblaApi.on("reInit", onSelect).on("select", onSelect)
  }, [emblaApi, onSelect])

  return {
    prevBtnDisabled,
    nextBtnDisabled,
    onPrevButtonClick,
    onNextButtonClick,
  }
}
