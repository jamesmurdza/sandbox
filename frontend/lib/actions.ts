"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { editUserSchema } from "./schema"
import { UserLink } from "./types"
import { fetchWithAuth } from "./server-utils"
import { parseSocialLink } from "./utils"

export async function createSandbox(body: {
  type: string
  name: string
  userId: string
  visibility: string
}) {
  const res = await fetchWithAuth(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/api/sandbox`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
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
  await fetchWithAuth(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/sandbox`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  revalidatePath("/dashboard")
}

export async function deleteSandbox(id: string) {
  await fetchWithAuth(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/api/sandbox?id=${id}`,
    {
      method: "DELETE",
    }
  )

  revalidatePath("/dashboard")
}

export async function shareSandbox(sandboxId: string, email: string) {
  const res = await fetchWithAuth(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/api/sandbox/share`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
  await fetchWithAuth(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/api/sandbox/share`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sandboxId, userId }),
    }
  )

  revalidatePath(`/code/${sandboxId}`)
}

export async function toggleLike(sandboxId: string, userId: string) {
  const res = await fetchWithAuth(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/api/sandbox/like`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
    const res = await fetchWithAuth(
      `${process.env.NEXT_PUBLIC_SERVER_URL}/api/user`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
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
export type GithubUser = {
  name: string
  avatar_url: string
  login: string
  html_url: string
  // ...the rest
}

export async function getGitHubUser({
  code,
  userId,
}: {
  code?: string
  userId: string
}) {
  const res = await fetchWithAuth(
    `${
      process.env.NEXT_PUBLIC_SERVER_URL
    }/api/github/user?${new URLSearchParams(
      code ? { code, userId } : { userId }
    )}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  )
  const json = await res.json()
  const data = json.data as GithubUser
  if (res.status !== 200) {
    return null
  }
  return data
}

export async function getGitHubAuthUrl() {
  const res = await fetchWithAuth(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/api/github/authenticate/url`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  )

  const data = (await res.json()).data as {
    auth_url: string
  }

  if (res.status !== 200) {
    throw new Error("No auth URL received")
  }
  return data
}

export async function githubLogin({
  code,
  userId,
}: {
  code: string
  userId: string
}) {
  const res = await fetchWithAuth(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/api/github/login`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code, userId }),
    }
  )
  const data = (await res.json()).data as GithubUser
  if (res.status !== 200) {
    throw new Error("Login failed")
  }
  return data
}

export async function githubLogout({ userId }: { userId: string }) {
  const res = await fetchWithAuth(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/api/github/logout`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId }),
    }
  )
  const data = (await res.json()).data as GithubUser

  if (res.status !== 200) {
    throw new Error("Logout failed")
  }
  return data
}

export async function getRepoStatus({ projectId }: { projectId: string }) {
  const res = await fetchWithAuth(
    `${
      process.env.NEXT_PUBLIC_SERVER_URL
    }/api/github/repo/status?${new URLSearchParams({ projectId })}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  )
  const data = (await res.json()).data as {
    existsInDB: boolean
    existsInGitHub: boolean
    repo?: {
      id: string
      name: string
    }
  }
  if (res.status !== 200) {
    throw new Error("Repo status check failed")
  }
  return data
}

export async function createRepo({ projectId }: { projectId: string }) {
  const res = await fetchWithAuth(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/api/github/repo/create`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ projectId }),
    }
  )
  const data = (await res.json()).data as { repoUrl: string }
  if (res.status !== 200) {
    throw new Error("Repo creation failed")
  }
  return data
}

export async function createCommit({
  projectId,
  message,
}: {
  projectId: string
  message: string
}) {
  const res = await fetchWithAuth(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/api/github/repo/commit`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ projectId, message }),
    }
  )
  const data = (await res.json()).data as { repoUrl: string }
  if (res.status !== 200) {
    throw new Error("Repo creation failed")
  }
  return data
}

export async function removeRepo({ projectId }: { projectId: string }) {
  const res = await fetchWithAuth(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/api/github/repo/remove`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ projectId }),
    }
  )
  const data = (await res.json()).data as null
  if (res.status !== 200) {
    throw new Error("Repo creation failed")
  }
  return data
}
