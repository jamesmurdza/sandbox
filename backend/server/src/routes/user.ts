import { drizzle } from "drizzle-orm/node-postgres" // Import drizzle for PostgreSQL
import { json } from "itty-router-extras"
import { z } from "zod"

import { eq, sql } from "drizzle-orm"
import * as schema from "../db/schema"
import { Sandbox, user } from "../db/schema"

import "dotenv/config" // Load the database credentials

interface SandboxWithLiked extends Sandbox {
  liked: boolean
}

interface UserResponse extends Omit<schema.User, "sandbox"> {
  sandbox: SandboxWithLiked[]
}

async function fetch(request: Request): Promise<Response> {
  const success = new Response("Success", { status: 200 })
  const invalidRequest = new Response("Invalid Request", { status: 400 })
  const notFound = new Response("Not Found", { status: 404 })
  const methodNotAllowed = new Response("Method Not Allowed", { status: 405 })

  const [path, query] = request.url.split("?")
  const searchParams = new URLSearchParams(query)
  const method = request.method

  const db = drizzle(process.env.DATABASE_URL as string, { schema })

  if (path === "/") {
    if (method === "GET") {
      if (searchParams.has("id")) {
        const id = searchParams.get("id") as string

        const res = await db.query.user.findFirst({
          where: (user, { eq }) => eq(user.id, id),
          with: {
            sandbox: {
              orderBy: (sandbox: any, { desc }) => [desc(sandbox.createdAt)],
              with: {
                likes: true,
              },
            },
            usersToSandboxes: true,
          },
        })
        if (res) {
          const transformedUser: UserResponse = {
            ...res,
            sandbox: (res.sandbox as Sandbox[]).map(
              (sb: any): SandboxWithLiked => ({
                ...sb,
                liked: sb.likes.some((like: any) => like.userId === id),
              })
            ),
          }
          return json(transformedUser)
        }
        return json(res ?? {})
      } else if (searchParams.has("username")) {
        const username = searchParams.get("username") as string
        const userId = searchParams.get("currentUserId")
        const res = await db.query.user.findFirst({
          where: (user, { eq }) => eq(user.username, username),
          with: {
            sandbox: {
              orderBy: (sandbox: any, { desc }) => [desc(sandbox.createdAt)],
              with: {
                likes: true,
              },
            },
            usersToSandboxes: true,
          },
        })
        if (res) {
          const transformedUser: UserResponse = {
            ...res,
            sandbox: (res.sandbox as Sandbox[]).map(
              (sb: any): SandboxWithLiked => ({
                ...sb,
                liked: sb.likes.some((like: any) => like.userId === userId),
              })
            ),
          }
          return json(transformedUser)
        }
        return json(res ?? {})
      } else {
        const res = await db.select().from(user)
        return json(res ?? {})
      }
    } else if (method === "POST") {
      const userSchema = z.object({
        id: z.string(),
        name: z.string(),
        email: z.string().email(),
        username: z.string(),
        avatarUrl: z.string().optional(),
        githubToken: z.string().nullable().optional(),
        createdAt: z.string().optional(),
        generations: z.number().optional(),
        tier: z.enum(["FREE", "PRO", "ENTERPRISE"]).optional(),
        tierExpiresAt: z.number().optional(),
        lastResetDate: z.number().optional(),
      })

      const {
        id,
        name,
        email,
        username,
        avatarUrl,
        githubToken,
        createdAt,
        generations,
        tier,
        tierExpiresAt,
        lastResetDate,
      } = userSchema.parse(request.body)
      const res = (
        await db
          .insert(user)
          .values({
            id,
            name,
            email,
            username,
            avatarUrl,
            githubToken,
            createdAt: createdAt ? new Date(createdAt) : new Date(),
            generations,
            tier,
            tierExpiresAt: tierExpiresAt ? new Date(tierExpiresAt) : new Date(),
            lastResetDate: lastResetDate ? new Date(lastResetDate) : new Date(),
          })
          .returning()
      )[0]
      return json({ res })
    } else if (method === "DELETE") {
      if (searchParams.has("id")) {
        const id = searchParams.get("id") as string
        await db.delete(user).where(eq(user.id, id))
        return success
      } else return invalidRequest
    } else if (method === "PUT") {
      const updateUserSchema = z.object({
        id: z.string(),
        name: z.string().optional(),
        bio: z.string().optional(),
        personalWebsite: z.string().optional(),
        links: z
          .array(
            z.object({
              url: z.string(),
              platform: z.enum(schema.KNOWN_PLATFORMS),
            })
          )
          .optional(),
        email: z.string().email().optional(),
        username: z.string().optional(),
        avatarUrl: z.string().optional(),
        githubToken: z.string().nullable().optional(),
        generations: z.number().optional(),
      })

      try {
        const validatedData = updateUserSchema.parse(request.body)

        const { id, username, ...updateData } = validatedData

        // If username is being updated, check for existing username
        if (username) {
          const existingUser = (
            await db.select().from(user).where(eq(user.username, username))
          )[0]
          if (existingUser && existingUser.id !== id) {
            return json({ error: "Username already exists" }, { status: 409 })
          }
        }

        const cleanUpdateData = {
          ...updateData,
          ...(username ? { username } : {}),
        }

        const res = (
          await db
            .update(user)
            .set(cleanUpdateData)
            .where(eq(user.id, id))
            .returning()
        )[0]

        if (!res) {
          return json({ error: "User not found" }, { status: 404 })
        }

        return json({ res })
      } catch (error) {
        if (error instanceof z.ZodError) {
          return json({ error: error.errors }, { status: 400 })
        }
        return json({ error: "Internal server error" }, { status: 500 })
      }
    } else {
      return methodNotAllowed
    }
  } else if (path === "/check-username") {
    if (method === "GET") {
      const username = searchParams.get("username")

      if (!username) return invalidRequest

      const exists = await db.query.user.findFirst({
        where: (user, { eq }) => eq(user.username, username),
      })

      return json({ exists: !!exists })
    }
    return methodNotAllowed
  } else if (path === "/increment-generations" && method === "POST") {
    const schema = z.object({
      userId: z.string(),
    })

    const { userId } = schema.parse(request.body)

    await db
      .update(user)
      .set({ generations: sql`${user.generations} + 1` })
      .where(eq(user.id, userId))

    return success
  } else if (path === "/update-tier" && method === "POST") {
    const schema = z.object({
      userId: z.string(),
      tier: z.enum(["FREE", "PRO", "ENTERPRISE"]),
      tierExpiresAt: z.date(),
    })

    const { userId, tier, tierExpiresAt } = schema.parse(request.body)

    await db
      .update(user)
      .set({
        tier,
        tierExpiresAt,
        // Reset generations when upgrading tier
        generations: 0,
      })
      .where(eq(user.id, userId))

    return success
  } else if (path === "/check-reset" && method === "POST") {
    const schema = z.object({
      userId: z.string(),
    })

    const { userId } = schema.parse(request.body)

    const dbUser = await db.query.user.findFirst({
      where: (user, { eq }) => eq(user.id, userId),
    })

    if (!dbUser) {
      return new Response("User not found", { status: 404 })
    }

    const now = new Date()
    const lastReset = dbUser.lastResetDate
      ? new Date(dbUser.lastResetDate)
      : new Date(0)

    if (
      now.getMonth() !== lastReset.getMonth() ||
      now.getFullYear() !== lastReset.getFullYear()
    ) {
      await db
        .update(user)
        .set({
          generations: 0,
          lastResetDate: now,
        })
        .where(eq(user.id, userId))

      return new Response("Reset successful", { status: 200 })
    }

    return new Response("No reset needed", { status: 200 })
  } else return notFound
}

export default async (req: any, res: any) => {
  try {
    // The API router returns a Node.js response, but we need to send an Express.js response
    const response = await fetch(req)
    const reader = response.body?.getReader()
    const value = await reader?.read()
    const responseText = new TextDecoder().decode(value?.value)
    res.status(response.status).send(responseText)
  } catch (error) {
    console.error("Error processing API request:", error)
    res.status(500).send("Internal Server Error")
  }
}
