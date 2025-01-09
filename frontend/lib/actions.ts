"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { editUserSchema } from "./schema"
import { UserLink } from "./types"
import { parseSocialLink } from "./utils"

export async function createSandbox(body: {
  type: string
  name: string
  userId: string
  visibility: string
}) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_DATABASE_WORKER_URL}/api/sandbox`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `${process.env.NEXT_PUBLIC_WORKERS_KEY}`,
      },
      body: JSON.stringify(body),
    }
  )

  return await res.text()
}

export async function updateSandbox(body: {
  id: string
  name?: string
  visibility?: "public" | "private"
}) {
  await fetch(`${process.env.NEXT_PUBLIC_DATABASE_WORKER_URL}/api/sandbox`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `${process.env.NEXT_PUBLIC_WORKERS_KEY}`,
    },
    body: JSON.stringify(body),
  })

  revalidatePath("/dashboard")
}

export async function deleteSandbox(id: string) {
  await fetch(
    `${process.env.NEXT_PUBLIC_DATABASE_WORKER_URL}/api/sandbox?id=${id}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `${process.env.NEXT_PUBLIC_WORKERS_KEY}`,
      },
    }
  )

  revalidatePath("/dashboard")
}

export async function shareSandbox(sandboxId: string, email: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_DATABASE_WORKER_URL}/api/sandbox/share`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `${process.env.NEXT_PUBLIC_WORKERS_KEY}`,
      },
      body: JSON.stringify({ sandboxId, email }),
    }
  )
  const text = await res.text()

  if (res.status !== 200) {
    return { success: false, message: text }
  }

  revalidatePath(`/code/${sandboxId}`)
  return { success: true, message: "Shared successfully." }
}

export async function unshareSandbox(sandboxId: string, userId: string) {
  await fetch(
    `${process.env.NEXT_PUBLIC_DATABASE_WORKER_URL}/api/sandbox/share`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `${process.env.NEXT_PUBLIC_WORKERS_KEY}`,
      },
      body: JSON.stringify({ sandboxId, userId }),
    }
  )

  revalidatePath(`/code/${sandboxId}`)
}

export async function toggleLike(sandboxId: string, userId: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_DATABASE_WORKER_URL}/api/sandbox/like`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `${process.env.NEXT_PUBLIC_WORKERS_KEY}`,
      },
      body: JSON.stringify({ sandboxId, userId }),
    }
  )
  revalidatePath(`/[username]`, "page")
  revalidatePath(`/dashboard`, "page")
}

const UpdateErrorSchema = z.object({
  error: z
    .union([
      z.string(),
      z.array(
        z.object({
          path: z.array(z.string()),
          message: z.string(),
        })
      ),
    ])
    .optional(),
})

interface FormState {
  message: string
  error?: any
  newRoute?: string
  fields?: Record<string, unknown>
}
export async function updateUser(
  prevState: any,
  formData: FormData
): Promise<FormState> {
  let data = Object.fromEntries(formData)
  let links: UserLink[] = []
  Object.entries(data).forEach(([key, value]) => {
    if (key.startsWith("link")) {
      const [_, index] = key.split(".")
      if (value) {
        links.splice(parseInt(index), 0, parseSocialLink(value as string))
        delete data[key]
      }
    }
  })
  // @ts-ignore
  data.links = links
  try {
    const validatedData = editUserSchema.parse(data)
    const changedUsername = validatedData.username !== validatedData.oldUsername
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_DATABASE_WORKER_URL}/api/user`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `${process.env.NEXT_PUBLIC_WORKERS_KEY}`,
        },
        body: JSON.stringify({
          id: validatedData.id,
          username: data.username ?? undefined,
          name: data.name ?? undefined,
          bio: data.bio ?? undefined,
          personalWebsite: data.personalWebsite ?? undefined,
          links: data.links ?? undefined,
        }),
      }
    )

    const responseData = await res.json()

    // Validate the response using our error schema
    const parseResult = UpdateErrorSchema.safeParse(responseData)

    if (!parseResult.success) {
      return {
        message: "Unexpected error occurred",
        error: parseResult.error,
        fields: validatedData,
      }
    }

    if (changedUsername) {
      const newRoute = `/@${validatedData.username}`
      return { message: "Successfully updated", newRoute }
    }
    revalidatePath(`/[username]`, "page")
    return { message: "Successfully updated" }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        message: "Invalid data",
        error: error.errors,
        fields: data,
      }
    }

    return { message: "An unexpected error occurred", fields: data }
  }
}
