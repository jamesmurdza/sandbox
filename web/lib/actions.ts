"use server"

import { apiClient } from "@/server/client"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { editUserSchema } from "./schema"
import { UserLink } from "./types"
import { parseSocialLink } from "./utils"

export async function createSandbox(body: {
  type: string
  name: string
  userId: string
  visibility: "public" | "private"
}) {
  const res = await apiClient.project.$post({
    json: {
      ...body,
      repositoryId: null,
      containerId: null,
      createdAt: new Date(),
    },
  })
  if (!res.ok) {
    throw new Error("Failed to create sandbox")
  }
  return (await res.json()).data.sandbox.id
}

export async function updateSandbox(body: {
  id: string
  name?: string
  visibility?: "public" | "private"
}) {
  await apiClient.project.$patch({
    json: body,
  })

  revalidatePath("/dashboard")
}

export async function deleteSandbox(id: string) {
  await apiClient.project.$delete({
    query: { id },
  })

  revalidatePath("/dashboard")
}

export async function shareSandbox(sandboxId: string, email: string) {
  const res = await apiClient.project.share.$post({
    json: { sandboxId, email },
  })
  const text = await res.text()

  if (res.status !== 200) {
    return { success: false, message: text }
  }

  revalidatePath(`/code/${sandboxId}`)
  return { success: true, message: "Shared successfully." }
}

export async function unshareSandbox(sandboxId: string, userId: string) {
  await apiClient.project.share.$delete({
    json: { sandboxId, userId },
  })

  revalidatePath(`/code/${sandboxId}`)
}

export async function toggleLike(sandboxId: string, userId: string) {
  await apiClient.project.like.$post({
    json: { sandboxId, userId },
  })
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
    const res = await apiClient.user.$patch({
      json: {
        id: validatedData.id,
        username: validatedData.username ?? undefined,
        name: validatedData.name ?? undefined,
        bio: validatedData.bio ?? undefined,
        personalWebsite: validatedData.personalWebsite ?? undefined,
        links: validatedData.links ?? undefined,
      },
    })

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
