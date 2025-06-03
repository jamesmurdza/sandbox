import { createRouter } from "@/lib/server/create-app"
import jsonContent from "@/lib/server/utils"
import { and, eq, sql } from "drizzle-orm"
import { describeRoute } from "hono-openapi"
import { validator as zValidator } from "hono-openapi/zod"
import z from "zod"
import { db } from "../db"
import {
  sandbox,
  sandboxInsertSchema,
  sandboxLikes,
  usersToSandboxes,
} from "../db/schema"

export const sandboxRouter = createRouter()
  // #region GET /
  .get(
    "/",
    describeRoute({
      tags: ["Sandbox"],
      description: "Get sandbox data",
      responses: {
        200: jsonContent(z.object({}), "Sandbox data response"),
      },
    }),
    zValidator(
      "query",
      z.object({
        id: z.string().optional(),
      })
    ),
    async (c) => {
      const { id } = c.req.valid("query")
      if (id) {
        const res = await db.query.sandbox.findFirst({
          where: (sandbox, { eq }) => eq(sandbox.id, id),
          with: {
            usersToSandboxes: true,
          },
        })
        return c.json(res ?? {}, 200)
      } else {
        const res = await db.select().from(sandbox)
        return c.json(res ?? {}, 200)
      }
    }
  )
  // #endregion

  // #region DELETE /
  .delete(
    "/",
    describeRoute({
      tags: ["Sandbox"],
      description: "Delete a sandbox",
      responses: {
        200: jsonContent(z.object({}), "Sandbox deletion response"),
      },
    }),
    zValidator(
      "query",
      z.object({
        id: z.string(),
      })
    ),
    async (c) => {
      const { id } = c.req.valid("query")
      await db.delete(sandboxLikes).where(eq(sandboxLikes.sandboxId, id))
      await db
        .delete(usersToSandboxes)
        .where(eq(usersToSandboxes.sandboxId, id))
      await db.delete(sandbox).where(eq(sandbox.id, id))
      return c.json(
        { success: true, message: "Sandbox Deleted successfully" },
        200
      )
    }
  )
  // #endregion

  // #region POST /
  .post(
    "/",
    describeRoute({
      tags: ["Sandbox"],
      description: "Create or update a sandbox",
      responses: {
        200: jsonContent(z.object({}), "Sandbox creation/update response"),
      },
    }),
    zValidator("json", sandboxInsertSchema),
    async (c) => {
      const data = c.req.valid("json")
      const { type, name, userId, visibility, repositoryId } = data

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

      return c.json(
        {
          success: true,
          message: "Sandbox created successfully",
          data: {
            sandbox: sb,
          },
        },
        200
      )
    }
  )
  // #endregion

  // #region PATCH /
  .patch(
    "/",
    describeRoute({
      tags: ["Sandbox"],
      description: "Update a sandbox",
      responses: {
        200: jsonContent(z.object({}), "Sandbox update response"),
      },
    }),
    zValidator(
      "json",
      sandboxInsertSchema.extend({
        id: z.string().openapi({
          description: "Unique identifier for the sandbox to be updated",
          example: "sandbox_12345",
        }),
      })
    ),
    async (c) => {
      const data = c.req.valid("json")
      const { id, name, visibility, containerId, repositoryId } = data

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

      return c.json(
        {
          success: true,
          message: "Sandbox updated successfully",
          data: {
            sandbox: sb,
          },
        },
        200
      )
    }
  )
  // #endregion

  // #region GET /share
  .get(
    "/share",
    describeRoute({
      tags: ["Sandbox"],
      description: "Get shared sandbox data",
      responses: {
        200: jsonContent(z.object({}), "Shared sandbox data response"),
      },
    }),
    zValidator(
      "query",
      z.object({
        id: z.string().openapi({
          description: "Unique identifier for the sandbox to be shared",
          example: "sandbox_12345",
        }),
      })
    ),
    async (c) => {
      const { id } = c.req.valid("query")
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

      return c.json(
        {
          success: true,
          message: "Shared sandboxes retrieved successfully",
          data: owners,
        },
        200
      )
    }
  )
  // #endregion

  // #region POST /share
  .post(
    "/share",
    describeRoute({
      tags: ["Sandbox"],
      description: "Share a sandbox with a user",
      responses: {
        200: jsonContent(z.object({}), "Sandbox sharing response"),
      },
    }),
    zValidator(
      "json",
      z.object({
        sandboxId: z.string(),
        email: z.string().email(),
      })
    ),
    async (c) => {
      const { sandboxId, email } = c.req.valid("json")

      const user = await db.query.user.findFirst({
        where: (user, { eq }) => eq(user.email, email),
        with: {
          sandbox: true,
          usersToSandboxes: true,
        },
      })

      if (!user) {
        return c.json(
          { success: false, message: "No user associated with email." },
          400
        )
      }

      if (
        Array.isArray(user.sandbox) &&
        user.sandbox.find((sb: any) => sb.id === sandboxId)
      ) {
        return c.json(
          { success: false, message: "Cannot share with yourself!" },
          400
        )
      }

      if (
        Array.isArray(user.usersToSandboxes) &&
        user.usersToSandboxes.find((uts: any) => uts.sandboxId === sandboxId)
      ) {
        return c.json(
          { success: false, message: "User already has access." },
          400
        )
      }

      await db
        .insert(usersToSandboxes)
        .values({ userId: user.id, sandboxId, sharedOn: new Date() })

      return c.json(
        {
          success: true,
          message: "Sandbox shared successfully",
        },
        200
      )
    }
  )
  // #endregion

  // #region DELETE /share
  .delete(
    "/share",
    describeRoute({
      tags: ["Sandbox"],
      description: "Remove sharing access from a user",
      responses: {
        200: jsonContent(z.object({}), "Sandbox sharing removal response"),
      },
    }),
    zValidator(
      "json",
      z.object({
        sandboxId: z.string(),
        userId: z.string(),
      })
    ),
    async (c) => {
      const { sandboxId, userId } = c.req.valid("json")

      await db
        .delete(usersToSandboxes)
        .where(
          and(
            eq(usersToSandboxes.userId, userId),
            eq(usersToSandboxes.sandboxId, sandboxId)
          )
        )

      return c.json(
        { success: true, message: "Sharing access removed successfully" },
        200
      )
    }
  )
  // #endregion

  // #region POST /like
  .post(
    "/like",
    describeRoute({
      tags: ["Sandbox"],
      description: "Like a sandbox",
      responses: {
        200: jsonContent(z.object({}), "Sandbox like response"),
      },
    }),
    zValidator(
      "json",
      z.object({
        userId: z.string(),
        sandboxId: z.string(),
      })
    ),
    async (c) => {
      const { userId, sandboxId } = c.req.valid("json")
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

        return c.json(
          {
            success: true,
            message: "Unlike successful",
            data: {
              liked: false,
            },
          },
          200
        )
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

        return c.json(
          {
            success: true,
            message: "Like successful",
            data: { liked: true },
          },
          200
        )
      }
    }
  )
  // #endregion

  // #region GET /like
  .get(
    "/like",
    describeRoute({
      tags: ["Sandbox"],
      description: "Check if a sandbox is liked by a user",
      responses: {
        200: jsonContent(z.object({}), "Sandbox like check response"),
      },
    }),
    zValidator(
      "query",
      z.object({
        sandboxId: z.string(),
        userId: z.string(),
      })
    ),
    async (c) => {
      const { sandboxId, userId } = c.req.valid("query")

      const like = await db.query.sandboxLikes.findFirst({
        where: (likes, { and, eq }) =>
          and(eq(likes.sandboxId, sandboxId), eq(likes.userId, userId)),
      })

      return c.json(
        {
          success: true,
          message: "Like check successful",
          data: { liked: !!like },
        },
        200
      )
    }
  )

// #endregion
