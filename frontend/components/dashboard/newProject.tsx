"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import Image from "next/image"
import { useState } from "react"
import { set, z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

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
import { useUser } from "@clerk/nextjs"
import { createSandbox } from "@/lib/actions"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "../ui/button"
import { projectTemplates } from "@/lib/data"

const formSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(16)
    .refine(
      (value) => /^[a-zA-Z0-9_]+$/.test(value),
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
  const [selected, setSelected] = useState("reactjs")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const user = useUser()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      visibility: "public",
    },
  })

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
        <div className="grid grid-cols-2 w-full gap-2 mt-2">
          {projectTemplates.map((item) => (
            <button
              disabled={item.disabled || loading}
              key={item.id}
              onClick={() => setSelected(item.id)}
              className={`${
                selected === item.id ? "border-foreground" : "border-border"
              } rounded-md border bg-card text-card-foreground shadow text-left p-4 flex flex-col transition-all focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className="space-x-2 flex items-center justify-start w-full">
                <Image alt="" src={item.icon} width={20} height={20} />
                <div className="font-medium">{item.name}</div>
              </div>
              <div className="mt-2 text-muted-foreground text-sm">
                {item.description}
              </div>
            </button>
          ))}
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
