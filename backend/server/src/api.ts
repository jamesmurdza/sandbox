import { drizzle } from "drizzle-orm/node-postgres" // Import drizzle for PostgreSQL
import { json } from "itty-router-extras"
import { z } from "zod"

import { and, eq, sql } from "drizzle-orm"
import * as schema from "./schema"
import {
  Sandbox,
  sandbox,
  sandboxLikes,
  user,
  usersToSandboxes,
} from "./schema"

// Add dotenv configuration
import dotenv from "dotenv"
dotenv.config()

// https://github.com/drizzle-team/drizzle-orm/tree/main/examples/cloudflare-d1

// npm run generate
// npx wrangler d1 execute d1-sandbox --local --file=./drizzle/<FILE>
interface SandboxWithLiked extends Sandbox {
  liked: boolean
}

interface UserResponse extends Omit<schema.User, "sandbox"> {
  sandbox: SandboxWithLiked[]
}

export default {
  async fetch(request: Request): Promise<Response> {
    const success = new Response("Success", { status: 200 })
    const invalidRequest = new Response("Invalid Request", { status: 400 })
    const notFound = new Response("Not Found", { status: 404 })
    const methodNotAllowed = new Response("Method Not Allowed", { status: 405 })

    const [path, query] = request.url.split("?")
    const searchParams = new URLSearchParams(query)
    const method = request.method

    const db = drizzle(process.env.DATABASE_URL as string, { schema })

    if (path === "/api/sandbox") {
      if (method === "GET") {
        if (searchParams.has("id")) {
          const id = searchParams.get("id") as string
          const res = await db.query.sandbox.findFirst({
            where: (sandbox, { eq }) => eq(sandbox.id, id),
            with: {
              usersToSandboxes: true,
            },
          })
          return json(res ?? {})
        } else {
          const res = await db.select().from(sandbox)
          return json(res ?? {})
        }
      } else if (method === "DELETE") {
        if (searchParams.has("id")) {
          const id = searchParams.get("id") as string
          await db.delete(sandboxLikes).where(eq(sandboxLikes.sandboxId, id))
          await db
            .delete(usersToSandboxes)
            .where(eq(usersToSandboxes.sandboxId, id))
          await db.delete(sandbox).where(eq(sandbox.id, id))

          return success
        } else {
          return invalidRequest
        }
      } else if (method === "POST") {
        const postSchema = z.object({
          id: z.string(),
          name: z.string().optional(),
          visibility: z.enum(["public", "private"]).optional(),
          containerId: z.string(),
        })

        const { id, name, visibility, containerId } = postSchema.parse(
          request.body
        )
        const sb = (
          await db
            .update(sandbox)
            .set({ name, visibility, containerId })
            .where(eq(sandbox.id, id))
            .returning()
        )[0]

        return success
      } else if (method === "PUT") {
        const initSchema = z.object({
          type: z.string(),
          name: z.string(),
          userId: z.string(),
          visibility: z.enum(["public", "private"]),
        })

        const { type, name, userId, visibility } = initSchema.parse(
          request.body
        )

        const userSandboxes = await db
          .select()
          .from(sandbox)
          .where(eq(sandbox.userId, userId))

        if (userSandboxes.length >= 8) {
          return new Response("You reached the maximum # of sandboxes.", {
            status: 400,
          })
        }

        const sb = (
          await db
            .insert(sandbox)
            .values({ type, name, userId, visibility, createdAt: new Date() })
            .returning()
        )[0]

        return new Response(sb.id, { status: 200 })
      } else {
        return methodNotAllowed
      }
    } else if (path === "/api/sandbox/share") {
      if (method === "GET") {
        if (searchParams.has("id")) {
          const id = searchParams.get("id") as string
          const res = await db.query.usersToSandboxes.findMany({
            where: (uts, { eq }) => eq(uts.userId, id),
          })

          const owners = await Promise.all(
            res.map(async (r) => {
              const sb = await db.query.sandbox.findFirst({
                where: (sandbox, { eq }) => eq(sandbox.id, r.sandboxId),
                with: {
                  author: true,
                },
              })
              if (
                sb &&
                "author" in sb &&
                sb.author &&
                "name" in sb.author &&
                "avatarUrl" in sb.author
              ) {
                return {
                  id: sb.id,
                  name: sb.name,
                  type: sb.type,
                  author: sb.author.name,
                  authorAvatarUrl: sb.author.avatarUrl,
                  sharedOn: r.sharedOn,
                }
              }
            })
          )

          return json(owners ?? {})
        } else return invalidRequest
      } else if (method === "POST") {
        const shareSchema = z.object({
          sandboxId: z.string(),
          email: z.string(),
        })

        const { sandboxId, email } = shareSchema.parse(request.body)

        const user = await db.query.user.findFirst({
          where: (user, { eq }) => eq(user.email, email),
          with: {
            sandbox: true,
            usersToSandboxes: true,
          },
        })

        if (!user) {
          return new Response("No user associated with email.", { status: 400 })
        }

        if (
          Array.isArray(user.sandbox) &&
          user.sandbox.find((sb: any) => sb.id === sandboxId)
        ) {
          return new Response("Cannot share with yourself!", { status: 400 })
        }

        if (
          Array.isArray(user.usersToSandboxes) &&
          user.usersToSandboxes.find((uts: any) => uts.sandboxId === sandboxId)
        ) {
          return new Response("User already has access.", { status: 400 })
        }


        await db
          .insert(usersToSandboxes)
          .values({ userId: user.id, sandboxId, sharedOn: new Date() })

        return success
      } else if (method === "DELETE") {
        const deleteShareSchema = z.object({
          sandboxId: z.string(),
          userId: z.string(),
        })

        const { sandboxId, userId } = deleteShareSchema.parse(request.body)

        await db
          .delete(usersToSandboxes)
          .where(
            and(
              eq(usersToSandboxes.userId, userId),
              eq(usersToSandboxes.sandboxId, sandboxId)
            )
          )

        return success
      } else return methodNotAllowed
    } else if (path === "/api/sandbox/like") {
      if (method === "POST") {
        const likeSchema = z.object({
          sandboxId: z.string(),
          userId: z.string(),
        })

        try {
          const { sandboxId, userId } = likeSchema.parse(request.body)

          // Check if user has already liked
          const existingLike = await db.query.sandboxLikes.findFirst({
            where: (likes, { and, eq }) =>
              and(eq(likes.sandboxId, sandboxId), eq(likes.userId, userId)),
          })

          if (existingLike) {
            // Unlike
            await db
              .delete(sandboxLikes)
              .where(
                and(
                  eq(sandboxLikes.sandboxId, sandboxId),
                  eq(sandboxLikes.userId, userId)
                )
              )

            await db
              .update(sandbox)
              .set({
                likeCount: sql`${sandbox.likeCount} - 1`,
              })
              .where(eq(sandbox.id, sandboxId))

            return json({
              message: "Unlike successful",
              liked: false,
            })
          } else {
            // Like
            await db.insert(sandboxLikes).values({
              sandboxId,
              userId,
              createdAt: new Date(),
            })

            await db
              .update(sandbox)
              .set({
                likeCount: sql`${sandbox.likeCount} + 1`,
              })
              .where(eq(sandbox.id, sandboxId))

            return json({
              message: "Like successful",
              liked: true,
            })
          }
        } catch (error) {
          return new Response("Invalid request format", { status: 400 })
        }
      } else if (method === "GET") {
        const sandboxId = searchParams.get("sandboxId")
        const userId = searchParams.get("userId")

        if (!sandboxId || !userId) {
          return invalidRequest
        }

        const like = await db.query.sandboxLikes.findFirst({
          where: (likes, { and, eq }) =>
            and(eq(likes.sandboxId, sandboxId), eq(likes.userId, userId)),
        })

        return json({
          liked: !!like,
        })
      } else {
        return methodNotAllowed
      }
    } else if (path === "/api/user") {
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
              tierExpiresAt: tierExpiresAt
                ? new Date(tierExpiresAt)
                : new Date(),
              lastResetDate: lastResetDate
                ? new Date(lastResetDate)
                : new Date(),
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
    } else if (path === "/api/user/check-username") {
      if (method === "GET") {
        const username = searchParams.get("username")

        if (!username) return invalidRequest

        const exists = await db.query.user.findFirst({
          where: (user, { eq }) => eq(user.username, username),
        })

        return json({ exists: !!exists })
      }
      return methodNotAllowed
    } else if (
      path === "/api/user/increment-generations" &&
      method === "POST"
    ) {
      const schema = z.object({
        userId: z.string(),
      })

      const { userId } = schema.parse(request.body)

      await db
        .update(user)
        .set({ generations: sql`${user.generations} + 1` })
        .where(eq(user.id, userId))

      return success
    } else if (path === "/api/user/update-tier" && method === "POST") {
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
    } else if (path === "/api/user/check-reset" && method === "POST") {
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
  },
}
