import { drizzle } from "drizzle-orm/node-postgres" // Import drizzle for PostgreSQL
import { json } from "itty-router-extras"
import { z } from "zod"

import { and, eq, sql } from "drizzle-orm"
import * as schema from "../db/schema"
import { sandbox, sandboxLikes, usersToSandboxes } from "../db/schema"

import "dotenv/config" // Load the database credentials

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
        containerId: z.string().nullable().optional(),
        repositoryId: z.string().nullable().optional(),
      })

      const { id, name, visibility, containerId, repositoryId } =
        postSchema.parse(request.body)
      const sb = (
        await db
          .update(sandbox)
          .set({
            name,
            visibility,
            containerId,
            repositoryId,
          })
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
        repositoryId: z.string().nullable().optional(),
      })

      const { type, name, userId, visibility, repositoryId } = initSchema.parse(
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
          .values({
            type,
            name,
            userId,
            visibility,
            createdAt: new Date(),
            repositoryId,
          })
          .returning()
      )[0]

      return new Response(sb.id, { status: 200 })
    } else {
      return methodNotAllowed
    }
  } else if (path === "/share") {
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
  } else if (path === "/like") {
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
